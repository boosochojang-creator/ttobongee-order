import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PAYMENT_ENABLED } from '../../../lib/flags'

// [항목2-2] 주문 생성 서버 이관 — 기존 anon 클라이언트 직접 insert를 service role 서버 API로.
// 손님 화면/흐름은 그대로(추가 인증 없음). 서버에서 회원·영업상태 검증 + 가격 재계산(위변조 방지) 후 insert.
// 결제(PortOne)는 현재 비활성(PAYMENT_ENABLED=false) — 접수(cash_pending)까지만.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const sid: string = b.storeId || 'baegun'
    const items: any[] = Array.isArray(b.items) ? b.items : []
    const userId: string | null = b.userId || null
    const orderType: string = b.orderType === 'takeout' ? 'takeout' : 'dine_in' // 배달 비활성 — 매장/포장만
    const tableNoStr: string = String(b.tableNo ?? '0')
    const payMethod: string | undefined = b.payMethod

    if (!items.length) return NextResponse.json({ ok: false, error: '주문 항목이 없어요' }, { status: 400 })
    // [항목2] 주문은 회원만 — 서버 권위 검증(비회원·가짜 userId 차단)
    if (!userId) return NextResponse.json({ ok: false, error: '주문은 단골 등록(로그인) 후 가능해요' }, { status: 403 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // 회원 확인 — 이 매장의 유효(미탈퇴) 회원인지
    const { data: member } = await admin.from('users')
      .select('id, withdrawn_at').eq('id', userId).eq('store_id', sid).maybeSingle()
    if (!member || (member as any).withdrawn_at) {
      return NextResponse.json({ ok: false, error: '회원 확인이 필요해요. 다시 로그인해주세요' }, { status: 403 })
    }

    // 영업상태 — 마감 중이면 주문 차단(권위적 재확인)
    const { data: store } = await admin.from('stores').select('is_open').eq('id', sid).maybeSingle()
    if (store && (store as any).is_open === false) {
      return NextResponse.json({ ok: false, error: '지금은 영업 준비 중이라 주문을 받을 수 없어요' }, { status: 409 })
    }

    // 가격 재계산 — 클라이언트 값 신뢰하지 않고 메뉴 실가격으로(위변조 방지)
    const ids = items.map(i => i.id)
    const { data: menus } = await admin.from('menus').select('id, name, price').eq('store_id', sid).in('id', ids)
    const priceMap = new Map((menus || []).map((m: any) => [m.id, m]))
    let total = 0
    const orderItems: any[] = []
    for (const it of items) {
      const m: any = priceMap.get(it.id)
      if (!m) return NextResponse.json({ ok: false, error: '메뉴 정보를 확인할 수 없어요. 새로고침 후 다시 시도해주세요' }, { status: 400 })
      const qty = Math.max(1, Math.floor(Number(it.qty) || 1))
      total += m.price * qty
      orderItems.push({ menu_id: m.id, name_snapshot: m.name, price_snapshot: m.price, qty, subtotal: m.price * qty })
    }
    const discount = Math.round(total * 0.05) // 단골 5% (회원만 도달)
    const finalAmount = total - discount
    const status = (!PAYMENT_ENABLED || payMethod === 'cash') ? 'cash_pending' : 'pending'

    // 증정 쿠폰(가격 0) — 클라이언트가 적용한 쿠폰 증정 메뉴. 실제 쿠폰 used 처리는 점주 접수 시.
    const gifts: any[] = Array.isArray(b.gifts) ? b.gifts : []
    // 포장 픽업 예약(외부 픽업형: table_no=0 포장에서만) — ISO 문자열
    const pickupAt: string | null = (orderType === 'takeout' && tableNoStr === '0' && b.pickupAt) ? b.pickupAt : null

    const { data: order, error } = await admin.from('orders').insert({
      store_id: sid,
      table_no: Number(tableNoStr) || 0,
      order_type: orderType,
      status,
      total_amount: total,
      discount_amount: discount,
      final_amount: finalAmount,
      payment_method: PAYMENT_ENABLED ? payMethod : null,
      user_id: userId,
      is_member: true,
      ...(gifts.length ? { free_gifts: gifts } : {}),
      ...(pickupAt ? { pickup_at: pickupAt } : {}),
    }).select('id').single()
    if (error || !order) throw error || new Error('주문 생성 실패')

    const { error: iErr } = await admin.from('order_items').insert(orderItems.map(oi => ({ ...oi, order_id: order.id })))
    if (iErr) throw iErr

    return NextResponse.json({ ok: true, orderId: order.id, finalAmount })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || '주문 접수 중 오류가 발생했어요' }, { status: 500 })
  }
}
