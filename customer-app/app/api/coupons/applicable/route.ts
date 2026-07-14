import { NextRequest, NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

// 메뉴 증정 쿠폰 — 이 주문에 지금 적용 가능한 쿠폰 '전체'를 반환(다중 증정).
// 조건: 본인 · status='active' · 사용가능일(usable_from) 지남 · 미만료(expires_at>now) · 최소주문 충족.
export const dynamic = 'force-dynamic'
const LABEL: Record<string, string> = { signup: '신규가입', birthday: '생일', winback: '재방문', vip_thanks: '단골감사' }

export async function GET(req: NextRequest) {
  noStore()
  try {
    const sp = req.nextUrl.searchParams
    const userId = sp.get('userId')
    const amount = Number(sp.get('amount') || 0)
    if (!userId) return NextResponse.json({ ok: true, coupons: [] })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const nowIso = new Date().toISOString()
    const { data } = await admin.from('coupons')
      .select('id, type, free_menu, free_qty, min_order_amount, usable_from')
      .eq('user_id', userId).eq('status', 'active')
      .gt('expires_at', nowIso)
      .lte('min_order_amount', amount)
      .order('issued_at', { ascending: true })

    // usable_from 컬럼이 있으면 '사용 가능일' 지난 것만 (없거나 null이면 바로 사용 가능으로 간주 = 마이그레이션 내성)
    const usable = (data || []).filter(c => !c.usable_from || c.usable_from <= nowIso)
    const coupons = usable.map(c => ({
      id: c.id,
      type: c.type,
      label: LABEL[c.type] || '쿠폰',
      menu: c.free_menu || '증정',
      qty: c.free_qty || 1,
    }))
    return NextResponse.json({ ok: true, coupons })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
