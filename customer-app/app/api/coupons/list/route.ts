import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// [2] 내 쿠폰함 — 회원 본인의 쿠폰 전체(사용가능/사용됨/만료됨)를 사람이 읽는 사유·기한과 함께 반환.
// 서비스롤 사용(쿠폰 위변조/타인 조회 방지). 만료는 DB를 바꾸지 않고 조회 시점에 계산(이력 보존).

// 발급 사유 → 고객에게 보여줄 문구 (내부 조건명 노출 금지)
const REASON: Record<string, { label: string; emoji: string }> = {
  signup:     { label: '신규가입 축하', emoji: '🎉' },
  birthday:   { label: '생일 축하',     emoji: '🎂' },
  winback:    { label: '오랜만이에요',  emoji: '💛' },
  vip_thanks: { label: '단골 감사',     emoji: '👑' },
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ ok: true, coupons: [] })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data, error } = await admin.from('coupons')
      .select('id, type, discount_amount, free_menu, free_qty, min_order_amount, status, issued_at, usable_from, expires_at, used_at')
      .eq('user_id', userId)
      .not('free_menu', 'is', null)   // 옛 금액할인 쿠폰은 이력용(DB 보존) → 고객 쿠폰함엔 숨김
      .order('issued_at', { ascending: false })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const now = Date.now()
    const coupons = (data || []).map(c => {
      const expired = c.expires_at ? new Date(c.expires_at).getTime() < now : false
      const used = c.status === 'used' || !!c.used_at
      const notYet = c.usable_from ? new Date(c.usable_from).getTime() > now : false // 아직 사용가능일 전
      const state: 'usable' | 'upcoming' | 'used' | 'expired' =
        used ? 'used' : (expired || c.status !== 'active') ? 'expired' : notYet ? 'upcoming' : 'usable'
      const r = REASON[c.type] || { label: '쿠폰', emoji: '🎟️' }
      const gift = c.free_menu ? (c.free_qty && c.free_qty > 1 ? `${c.free_menu} ${c.free_qty}개` : c.free_menu) : null
      return {
        id: c.id,
        reason: r.label,
        emoji: r.emoji,
        gift,                            // 증정 메뉴 문구 (없으면 구 금액할인)
        discount_amount: c.discount_amount,
        min_order_amount: c.min_order_amount,
        issued_at: c.issued_at,
        usable_from: c.usable_from,
        expires_at: c.expires_at,
        state,
      }
    })
    return NextResponse.json({ ok: true, coupons })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
