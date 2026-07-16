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
      .select('user_id, coupon_id, free_gifts, payment_method, payment_id, final_amount').eq('id', order_id).single()

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

    // A2: 종료(결제완료/배달완료) 시점 = 방문(세션) 마감. closed_at 기록(방문 카운트 기준).
    // 컬럼 미존재 마이그레이션 전에도 상태변경이 막히지 않게 별도 best-effort.
    if (status === 'served' || status === 'delivered') {
      try { await admin.from('orders').update({ closed_at: new Date().toISOString() }).eq('id', order_id) } catch {}
    }

    // 상태 반영 후 회원이면 CRM 집계 재계산 (모든 결제수단이 이 관문을 지나므로 단일 갱신 지점).
    // 재계산 실패가 상태변경을 막지 않도록 격리 — 멱등이라 다음 상태변경 때 다시 정정된다.
    if (ord?.user_id) {
      try { await recomputeCustomer(admin, ord.user_id) } catch {}
    }
    // 접수(확정) 시점에 이 주문에 적용된 쿠폰을 used 처리.
    // 신방식(메뉴 증정): free_gifts에 담긴 쿠폰들을 전부 소진. 구방식(단일 coupon_id)도 함께 처리(하위호환).
    const CONFIRMED = new Set(['accepted', 'cooking', 'done', 'served', 'paid'])
    if (CONFIRMED.has(status)) {
      const giftIds = Array.isArray(ord?.free_gifts) ? (ord!.free_gifts as any[]).map(g => g?.coupon_id).filter(Boolean) : []
      const couponIds = Array.from(new Set([...(ord?.coupon_id ? [ord.coupon_id] : []), ...giftIds]))
      if (couponIds.length) {
        try {
          await admin.from('coupons')
            .update({ status: 'used', used_at: new Date().toISOString(), used_order_id: order_id })
            .in('id', couponIds).eq('status', 'active')
        } catch {}
      }
    }
    return NextResponse.json({ ok: true, refund })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
