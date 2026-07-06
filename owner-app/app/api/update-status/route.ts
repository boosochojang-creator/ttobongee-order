import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recomputeCustomer } from '../../lib/customerStats'

const VALID = new Set(['accepted', 'cooking', 'done', 'served', 'canceled', 'cash_pending', 'pending', 'paid', 'out_for_delivery', 'delivered'])

export async function POST(req: NextRequest) {
  try {
    const { order_id, status } = await req.json()
    if (!order_id || !VALID.has(status)) {
      return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
    }
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error } = await admin.from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', order_id)
    if (error) throw error

    // 상태 반영 후 회원이면 CRM 집계 재계산 (모든 결제수단이 이 관문을 지나므로 단일 갱신 지점).
    // 재계산 실패가 상태변경을 막지 않도록 격리 — 멱등이라 다음 상태변경 때 다시 정정된다.
    const { data: ord } = await admin.from('orders').select('user_id, coupon_id').eq('id', order_id).single()
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
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
