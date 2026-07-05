// Phase 3: 더치페이 서버 로직 (세션 시작 / 몫 예약 / 결제 확정 / 상태 조회)
// 원칙:
// - 몫(share)은 예약 테이블로 원자적으로 배정 → 동시 결제 경쟁에서도 잔돈(마지막 몫)이 정확히 1명에게만 간다
// - 결제 확정은 포트원 서버 재조회 + 몫 금액 대조 (그룹 D와 동일한 신뢰 원칙)
// - 전원 결제(all_paid) 시에만 원 주문을 paid로 → 주방 신호 (기존 흐름 그대로)
import { createClient } from '@supabase/supabase-js'

const PORTONE_API_BASE = process.env.PORTONE_API_BASE || 'https://api.portone.io'
const STALE_CLAIM_MS = 10 * 60 * 1000 // 10분 지난 미결제 예약은 재배정 허용

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// 금액 계산: 원 단위 절사, 잔돈은 마지막 결제자 몫에 합산
export function splitAmounts(total: number, n: number) {
  const per = Math.floor(total / n)
  const last = per + (total - per * n)
  return { per, last }
}

export async function startSession(orderId: string, participantCount: number) {
  const db = admin()
  const n = Math.floor(Number(participantCount))
  if (!n || n < 2 || n > 20) return { ok: false as const, error: '인원수는 2~20명이어야 해요' }

  const { data: order } = await db.from('orders')
    .select('id, status, order_type, final_amount, is_member').eq('id', orderId).single()
  if (!order) return { ok: false as const, error: '주문을 찾을 수 없어요' }
  if (order.order_type !== 'dine_in') return { ok: false as const, error: '더치페이는 홀(테이블) 주문에서만 가능해요' }
  if (order.status !== 'pending') return { ok: false as const, error: '이미 결제가 진행된 주문이에요' }

  // 같은 주문에 진행 중 세션이 있으면 재사용 (중복 시작 방지)
  const { data: existing } = await db.from('split_payment_sessions')
    .select('id').eq('table_order_id', orderId).neq('status', 'all_paid').limit(1)
  if (existing && existing.length) return { ok: true as const, sessionId: existing[0].id, reused: true }

  const { per, last } = splitAmounts(order.final_amount, n)
  const { data: session, error } = await db.from('split_payment_sessions').insert({
    table_order_id: orderId,
    total_amount: order.final_amount,
    participant_count: n,
    amount_per_person: per,
    last_payer_amount: last,
    is_member_pricing_applied: !!order.is_member,
  }).select('id').single()
  if (error || !session) return { ok: false as const, error: error?.message || '세션 생성 실패' }
  return { ok: true as const, sessionId: session.id }
}

// 몫 예약: 다음 순번을 원자적으로 배정 (마지막 순번 = 잔돈 포함 금액)
// 정책: 금액은 세션 시작 시점에 확정 — 합류자는 회원 여부와 무관하게 확정된 몫만 결제 (재계산 없음)
export async function claimShare(sessionId: string, memberUserId?: string | null) {
  const db = admin()
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: s } = await db.from('split_payment_sessions').select('*').eq('id', sessionId).single()
    if (!s) return { ok: false as const, error: '세션 없음' }
    if (s.status === 'all_paid') return { ok: false as const, error: '이미 전원 결제가 끝났어요' }

    const { data: shares } = await db.from('split_payment_shares')
      .select('id, share_index, status, created_at').eq('session_id', sessionId).neq('status', 'canceled')
    const active = shares || []

    if (active.length >= s.participant_count) {
      // 오래 방치된 미결제 예약이 있으면 취소하고 자리 재사용 (이탈자 대응)
      const stale = active.find(sh => sh.status === 'pending' &&
        Date.now() - new Date(sh.created_at).getTime() > STALE_CLAIM_MS)
      if (stale) {
        await db.from('split_payment_shares').update({ status: 'canceled' }).eq('id', stale.id).eq('status', 'pending')
        continue
      }
      return { ok: false as const, error: '모든 몫이 결제 진행 중이에요. 잠시 후 다시 시도해주세요' }
    }

    const index = Math.max(0, ...active.map(sh => sh.share_index)) + 1
    const isLast = index === s.participant_count
    const amount = isLast ? s.last_payer_amount : s.amount_per_person
    const shareId = crypto.randomUUID()
    const { error } = await db.from('split_payment_shares').insert({
      id: shareId, session_id: sessionId, share_index: index, amount,
      payment_id: `spl_${shareId}`, member_user_id: memberUserId || null,
    })
    if (error) continue // 순번 경쟁 (unique 충돌) → 재시도
    return { ok: true as const, shareId, paymentId: `spl_${shareId}`, amount, isLast, index }
  }
  return { ok: false as const, error: '자리 배정에 실패했어요. 다시 시도해주세요' }
}

// 결제 확정: 포트원 재조회 → 몫 금액 대조 → paid 처리 → 전원 완료 시 원 주문 paid (주방 신호)
export async function confirmShare(paymentId: string) {
  const db = admin()
  const { data: share } = await db.from('split_payment_shares')
    .select('*').eq('payment_id', paymentId).single()
  if (!share) return { ok: false as const, error: '결제 몫을 찾을 수 없어요' }
  if (share.status === 'paid') return await refreshSession(share.session_id) // 멱등

  const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `PortOne ${process.env.PORTONE_V2_API_SECRET}` }, cache: 'no-store',
  })
  if (res.status === 404) return { ok: false as const, error: '결제 내역이 없어요' }
  if (!res.ok) return { ok: false as const, error: `PortOne 조회 실패 (HTTP ${res.status})` }
  const payment = await res.json()
  if (payment.status !== 'PAID') return { ok: false as const, error: `결제가 완료되지 않았어요 (상태: ${payment.status})` }
  if (payment.amount?.total !== share.amount) {
    return { ok: false as const, error: `결제 금액 불일치 (실제: ${payment.amount?.total}, 몫: ${share.amount}) — 직원에게 문의해주세요` }
  }

  await db.from('split_payment_shares').update({ status: 'paid' }).eq('id', share.id).eq('status', 'pending')
  return await refreshSession(share.session_id)
}

// paid 몫 수 재집계 → 세션 상태 갱신 → 전원 완료면 원 주문 확정
async function refreshSession(sessionId: string) {
  const db = admin()
  const { data: s } = await db.from('split_payment_sessions').select('*').eq('id', sessionId).single()
  if (!s) return { ok: false as const, error: '세션 없음' }

  const { data: paidShares } = await db.from('split_payment_shares')
    .select('id, amount').eq('session_id', sessionId).eq('status', 'paid')
  const paidCount = (paidShares || []).length
  const allPaid = paidCount >= s.participant_count
  const status = allPaid ? 'all_paid' : paidCount > 0 ? 'partial_paid' : 'waiting'

  await db.from('split_payment_sessions').update({ paid_count: paidCount, status }).eq('id', sessionId)

  if (allPaid) {
    // 전원 결제 완료 → 이 시점에만 주방으로 (기존 주문 흐름과 동일하게 paid 전환)
    const { data: updated } = await db.from('orders').update({ status: 'paid', payment_id: `split:${sessionId}` })
      .eq('id', s.table_order_id).in('status', ['pending', 'canceled']).select('id')
    if (updated && updated.length) {
      try {
        await db.from('payments').insert({
          order_id: s.table_order_id, method: 'split',
          amount: (paidShares || []).reduce((a, b) => a + b.amount, 0), pg_status: 'PAID',
        })
      } catch {}
    }
  }
  return { ok: true as const, paidCount, participantCount: s.participant_count, status }
}

export async function getSessionState(sessionId: string) {
  const db = admin()
  const { data: s } = await db.from('split_payment_sessions').select('*').eq('id', sessionId).single()
  if (!s) return { ok: false as const, error: '세션 없음' }
  return { ok: true as const, session: s }
}

// 방식 B 진입: 이 테이블에서 진행 중인 세션 찾기 (최근 2시간)
export async function findActiveSessionByTable(tableNo: number) {
  const db = admin()
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data: orders } = await db.from('orders')
    .select('id').eq('store_id', 'baegun').eq('table_no', tableNo)
    .eq('order_type', 'dine_in').eq('status', 'pending').gte('created_at', since)
  if (!orders || !orders.length) return { ok: true as const, session: null }
  const ids = orders.map(o => o.id)
  const { data: sessions } = await db.from('split_payment_sessions')
    .select('*').in('table_order_id', ids).neq('status', 'all_paid')
    .order('created_at', { ascending: false }).limit(1)
  return { ok: true as const, session: sessions?.[0] || null }
}
