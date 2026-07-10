import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recomputeCustomer } from '../../lib/customerStats'
import { refundOrder, type RefundSummary } from '../../lib/refund'

const VALID = new Set(['accepted', 'cooking', 'done', 'served', 'canceled', 'cash_pending', 'pending', 'paid', 'out_for_delivery', 'delivered'])

export async function POST(req: NextRequest) {
  try {
    const { order_id, status, cancel_reason } = await req.json()
    if (!order_id || !VALID.has(status)) {
      return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
    }
    // 취소 사유(점주가 버튼으로 선택)는 취소일 때만 저장 (고객 화면에 안내됨)
    const reason = status === 'canceled' && typeof cancel_reason === 'string'
      ? cancel_reason.trim().slice(0, 60) : null
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 결제 정보를 먼저 확보 (상태변경은 payment_id/method를 건드리지 않으므로 순서 무관하지만, 취소 환불에 필요).
    const { data: ord } = await admin.from('orders')
      .select('user_id, coupon_id, payment_method, payment_id, final_amount').eq('id', order_id).single()

    // 점주 취소 → 주문에 연결된 포트원 결제건 전부 환불(취소). 실패해도 상태변경은 진행(아래).
    // refundOrder는 예외를 던지지 않고 요약을 반환 → 실패 건수만 응답에 실어 점주에게 표시.
    let refund: RefundSummary | undefined
    if (status === 'canceled' && ord) {
      try { refund = await refundOrder(admin, { id: order_id, ...ord }) } catch {}
    }

    const { error } = await admin.from('orders')
      .update({ status, updated_at: new Date().toISOString(), ...(status === 'canceled' ? { cancel_reason: reason } : {}) })
      .eq('id', order_id)
    if (error) throw error

    // 상태 반영 후 회원이면 CRM 집계 재계산 (모든 결제수단이 이 관문을 지나므로 단일 갱신 지점).
    // 재계산 실패가 상태변경을 막지 않도록 격리 — 멱등이라 다음 상태변경 때 다시 정정된다.
    if (ord?.user_id) {
      try { await recomputeCustomer(admin, ord.user_id) } catch {}
    }
    // 현금결제 등 confirmPayment를 안 타는 주문: 접수(확정) 시점에 쿠폰 used 처리.
    // 카드/전자결제는 이미 결제확정 시 used라 .eq(status,active) 가드로 no-op. 취소/대기 상태에선 처리 안 함.
    const CONFIRMED = new Set(['accepted', 'cooking', 'done', 'served', 'paid'])
    if (ord?.coupon_id && CONFIRMED.has(status)) {
      try {
        await admin.from('coupons')
          .update({ status: 'used', used_at: new Date().toISOString(), used_order_id: order_id })
          .eq('id', ord.coupon_id).eq('status', 'active')
      } catch {}
    }
    return NextResponse.json({ ok: true, refund })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
