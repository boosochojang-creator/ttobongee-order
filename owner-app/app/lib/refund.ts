// 그룹 D 보완: 점주 주문취소 시 포트원 결제 환불(취소) 연동
// 원칙: 주문에 연결된 실제 포트원 결제건을 전부(1건이든 여러건이든) 조회해 각각 취소.
//  - 일반결제(card/kakao/toss): orders.payment_id = 실제 포트원 결제ID (= order.id, checkout에서 paymentId:order.id로 요청)
//  - 더치페이(split): orders.payment_id = 'split:{sessionId}' → split_payment_shares에서 status='paid' 몫들의 spl_ 결제ID
//  - 현금(cash): 포트원 결제 없음 → 환불 대상 없음
// 실패해도 주문 상태변경(canceled)은 막지 않고, 결과를 payments 테이블에 로그로 남긴다(DDL 불필요).
import type { SupabaseClient } from '@supabase/supabase-js'

// 테스트에서 가짜 포트원 서버를 쓸 수 있도록 주소만 env로 분리 (기본값 = 실서버) — 기존 paymentConfirm.ts와 동일 패턴
const PORTONE_API_BASE = process.env.PORTONE_API_BASE || 'https://api.portone.io'

export type CancelOutcome =
  | { paymentId: string; ok: true; note: 'cancelled' | 'already_cancelled' | 'not_paid' }
  | { paymentId: string; ok: false; error: string }

// 단일 포트원 결제 취소(전액 환불). 이미 취소/미결제는 멱등 성공으로 처리 → 재클릭·중복 웹훅에도 안전.
export async function portoneCancel(paymentId: string, reason: string): Promise<CancelOutcome> {
  try {
    const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `PortOne ${process.env.PORTONE_V2_API_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
      cache: 'no-store',
    })
    if (res.ok) return { paymentId, ok: true, note: 'cancelled' }
    // 에러 본문의 type으로 멱등/무결제 케이스 분기 (포트원 V2 에러 스키마: { type, message })
    let type = ''
    try { type = (await res.json())?.type || '' } catch {}
    if (type === 'ALREADY_CANCELLED' || type === 'PAYMENT_ALREADY_CANCELLED')
      return { paymentId, ok: true, note: 'already_cancelled' } // 이미 취소됨 → 목적 달성
    if (type === 'PAYMENT_NOT_PAID' || type === 'PAYMENT_NOT_FOUND')
      return { paymentId, ok: true, note: 'not_paid' } // 결제상태 아님 → 환불할 것이 없음(정상)
    return { paymentId, ok: false, error: `HTTP ${res.status}${type ? ` ${type}` : ''}` }
  } catch (e: any) {
    return { paymentId, ok: false, error: e?.message || 'network error' }
  }
}

type OrderLike = { id?: string; payment_method?: string | null; payment_id?: string | null; final_amount?: number | null }

// 주문에 연결된 실제 포트원 결제ID들을 수집 (1건 또는 여러건). 현금·미결제는 빈 배열.
export async function collectPaymentIds(db: SupabaseClient, order: OrderLike): Promise<string[]> {
  const pid = order.payment_id || ''
  // 더치페이: 결제 완료된 몫들의 실제 포트원 결제ID(spl_...)를 몫별로 조회
  if (pid.startsWith('split:')) {
    const sessionId = pid.slice('split:'.length)
    const { data: shares } = await db.from('split_payment_shares')
      .select('payment_id').eq('session_id', sessionId).eq('status', 'paid')
    return (shares || []).map((s: any) => s.payment_id).filter(Boolean)
  }
  // 현금결제: 포트원 결제 없음 → 환불 대상 없음
  if (order.payment_method === 'cash') return []
  // 일반 전자결제: payment_id가 곧 포트원 결제ID
  if (pid) return [pid]
  return []
}

export type RefundSummary = { attempted: number; succeeded: number; failed: number; outcomes: CancelOutcome[] }

// 주문 환불 오케스트레이션: 결제ID 수집 → 각각 취소 → payments 테이블에 결과 로그.
// 반환값의 failed>0 이면 호출측(update-status)이 응답에 실어 점주에게 "환불 실패" 표시.
export async function refundOrder(db: SupabaseClient, order: OrderLike, reason = '점주 주문취소'): Promise<RefundSummary> {
  const ids = await collectPaymentIds(db, order)
  const outcomes: CancelOutcome[] = []
  for (const id of ids) outcomes.push(await portoneCancel(id, reason)) // 몫이 여러건이어도 같은 코드로 순차 취소
  const succeeded = outcomes.filter(o => o.ok).length
  const failed = outcomes.length - succeeded
  const summary: RefundSummary = { attempted: ids.length, succeeded, failed, outcomes }

  // 결과 로그: 기존 payments 테이블 재사용(DDL 없이 감사기록 + '환불 실패' 흔적). 시도 건이 있을 때만 기록.
  if (ids.length > 0) {
    try {
      await db.from('payments').insert({
        order_id: order.id,
        method: order.payment_method === 'split' ? 'split_refund' : 'refund',
        amount: -(order.final_amount || 0), // 환불이므로 음수. (CRM/통계는 orders 기반이라 payments 합산 영향 없음)
        pg_status: failed > 0 ? (succeeded > 0 ? 'CANCEL_PARTIAL' : 'CANCEL_FAILED') : 'CANCELLED',
        webhook_log: summary as any,
      })
    } catch {}
  }
  return summary
}
