import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { STORE_ID } from '../../../lib/store'

// [1] 쿠폰성과/세그먼트용 — 이 매장 쿠폰 전체를 서비스롤로 반환.
// (coupons는 RLS로 anon SELECT가 차단돼 CouponStats·couponUsers가 0행만 받던 버그 수정)
// coupons엔 store_id가 없어 store 회원(user_id) 경유로 스코핑.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST() {
  noStore()
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: us } = await admin.from('users').select('id').eq('store_id', STORE_ID)
    const ids = (us || []).map(u => u.id)
    if (!ids.length) return NextResponse.json({ ok: true, coupons: [] })
    const { data: coupons } = await admin.from('coupons')
      .select('id, type, status, issued_at, used_order_id, user_id, expires_at')
      .in('user_id', ids)
    return NextResponse.json({ ok: true, coupons: coupons || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
