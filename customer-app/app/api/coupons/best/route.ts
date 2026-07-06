import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Phase 4-B: 결제 자동적용용 최적 쿠폰 선택 (서비스롤 — 위변조 방지)
// 유효(active·미만료) + 최소주문충족(min_order_amount <= amount) 중 할인액 최대 1개.
const LABEL: Record<string, string> = { signup: '신규가입', birthday: '생일', winback: '재방문', vip_thanks: '단골감사' }

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const userId = sp.get('userId')
    const amount = Number(sp.get('amount') || 0)
    if (!userId) return NextResponse.json({ ok: true, coupon: null })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data } = await admin.from('coupons')
      .select('id, type, discount_amount, min_order_amount')
      .eq('user_id', userId).eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .lte('min_order_amount', amount)
      .order('discount_amount', { ascending: false })
      .limit(1)

    const c = data?.[0]
    return NextResponse.json({
      ok: true,
      coupon: c ? { id: c.id, label: LABEL[c.type] || '쿠폰', discount: c.discount_amount } : null,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
