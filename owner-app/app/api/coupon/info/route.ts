import { NextRequest, NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

// 오너 화면용 쿠폰 정보 조회 — coupons 테이블은 RLS로 익명(anon) 읽기가 막혀 있어
// 주문에 붙은 쿠폰(종류·할인액)을 점주 화면에서 보려면 서비스롤로 별도 조회해야 한다.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  noStore()
  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ ok: true, coupons: {} })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data, error } = await admin.from('coupons').select('id, type, discount_amount').in('id', ids.slice(0, 200))
    if (error) throw error
    const map: Record<string, { type: string; discount_amount: number }> = {}
    for (const c of data || []) map[c.id] = { type: c.type, discount_amount: c.discount_amount }
    return NextResponse.json({ ok: true, coupons: map })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
