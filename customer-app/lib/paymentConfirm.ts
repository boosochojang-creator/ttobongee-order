// 그룹 D: 서버 결제 확정 공용 로직
// 웹훅 / 클라이언트 복귀 검증(verify) / 백업 재조회(reconcile)가 전부 이 함수 하나를 쓴다.
// 원칙: 확정 기준은 "포트원에 서버가 직접 재조회한 결과 + DB에 저장된 주문 금액". 클라이언트 입력은 믿지 않는다.
import { createClient } from '@supabase/supabase-js'

// 테스트에서 가짜 포트원 서버를 쓸 수 있도록 주소만 env로 분리 (기본값 = 실서버)
const PORTONE_API_BASE = process.env.PORTONE_API_BASE || 'https://api.portone.io'

export type ConfirmResult =
  | { result: 'paid' }                                  // 검증 통과, paid 확정
  | { result: 'already_final'; status: string }         // 이미 주방 흐름 진입 — 건드리지 않음
  | { result: 'not_paid'; pgStatus: string }            // 포트원상 미결제/실패/취소
  | { result: 'not_found' }                             // 포트원에 해당 결제 없음
  | { result: 'mismatch'; paidAmount: number; orderAmount: number } // 금액 불일치 → verification_failed
  | { result: 'order_missing' }
  | { result: 'error'; message: string }

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function confirmPayment(orderId: string, paymentId?: string): Promise<ConfirmResult> {
  const db = admin()
  const pid = paymentId || orderId

  const { data: order } = await db.from('orders')
    .select('status, final_amount, coupon_id').eq('id', orderId).single()
  if (!order) return { result: 'order_missing' }

  // 주방 흐름(그룹 C)에 들어간 주문은 어떤 경우에도 되돌리지 않는다
  if (['accepted', 'cooking', 'done', 'served'].includes(order.status)) {
    return { result: 'already_final', status: order.status }
  }
  if (order.status === 'paid') return { result: 'paid' } // 이미 확정 (중복 웹훅 등)

  const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(pid)}`, {
    headers: { Authorization: `PortOne ${process.env.PORTONE_V2_API_SECRET}` },
    cache: 'no-store',
  })
  if (res.status === 404) return { result: 'not_found' }
  if (!res.ok) return { result: 'error', message: `PortOne 조회 실패 (HTTP ${res.status})` }
  const payment = await res.json()

  if (payment.status !== 'PAID') {
    // 포트원이 실패/취소로 확정한 결제의 대기 주문은 정리 (유령 주문 방지와 일관)
    if (['FAILED', 'CANCELLED'].includes(payment.status)) {
      await db.from('orders').update({ status: 'canceled' })
        .eq('id', orderId).eq('status', 'pending')
    }
    return { result: 'not_paid', pgStatus: payment.status }
  }

  const paidAmount = payment.amount?.total
  if (paidAmount !== order.final_amount) {
    // 금액 불일치 → 점주 확인 필요 상태로 분리 (011 미적용 시 조용히 실패 → pending 유지)
    await db.from('orders').update({ status: 'verification_failed' })
      .eq('id', orderId).in('status', ['pending', 'canceled'])
    return { result: 'mismatch', paidAmount, orderAmount: order.final_amount }
  }

  // 검증 통과 → paid 확정 (pending/취소복구/검증실패복구만 허용)
  const { data: updated, error } = await db.from('orders')
    .update({ status: 'paid', payment_id: pid })
    .eq('id', orderId).in('status', ['pending', 'canceled', 'verification_failed'])
    .select('id')
  if (error) return { result: 'error', message: error.message }

  // 실제로 이번에 확정된 경우에만 결제 기록 1건 남김 (중복 방지)
  if (updated && updated.length > 0) {
    try {
      await db.from('payments').insert({
        order_id: orderId,
        method: payment.method?.type || 'card',
        amount: paidAmount ?? 0,
        pg_status: 'PAID',
      })
    } catch {}
    // Phase 4-B: 자동적용된 쿠폰이 있으면 결제 성공 시점에만 사용됨 처리 (실패/취소 시엔 active 유지 → 원복 불필요)
    if (order.coupon_id) {
      try {
        await db.from('coupons')
          .update({ status: 'used', used_at: new Date().toISOString(), used_order_id: orderId })
          .eq('id', order.coupon_id).eq('status', 'active')
      } catch {}
    }
  }
  return { result: 'paid' }
}

// 웹훅 유실 대비 백업: 생성 후 2분~24시간 지난 대기 주문을 포트원에 직접 재조회
export async function reconcilePendingOrders(limit = 20) {
  const db = admin()
  const now = Date.now()
  const from = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const to = new Date(now - 2 * 60 * 1000).toISOString()

  const { data: orders } = await db.from('orders')
    .select('id')
    .eq('store_id', 'baegun').eq('status', 'pending')
    .gte('created_at', from).lte('created_at', to)
    .order('created_at', { ascending: false }).limit(limit)

  const summary: Record<string, number> = {}
  for (const o of orders || []) {
    const r = await confirmPayment(o.id)
    summary[r.result] = (summary[r.result] || 0) + 1
  }
  return { checked: (orders || []).length, summary }
}
