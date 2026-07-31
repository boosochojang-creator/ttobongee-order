import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// [D] 신규주문/목록 쿠폰 보유 뱃지용 — 주어진 회원들 중 '지금 쓸 수 있는 쿠폰' 보유자만 반환.
// 조건: status='active' · 사용가능일(usable_from) 지남 · 미만료 · 증정쿠폰(free_menu 有). 서비스롤(RLS 우회).
export async function POST(req: NextRequest) {
  try {
    const { userIds } = await req.json()
    if (!Array.isArray(userIds) || userIds.length === 0) return NextResponse.json({ ok: true, holders: [] })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const nowIso = new Date().toISOString()
    const { data } = await admin.from('coupons')
      .select('user_id, usable_from')
      .in('user_id', userIds)
      .eq('status', 'active')
      .not('free_menu', 'is', null)
      .gt('expires_at', nowIso)

    // usable_from 없으면 즉시 사용가능으로 간주(마이그레이션 내성)
    const holders = Array.from(new Set(
      (data || []).filter(c => !c.usable_from || c.usable_from <= nowIso).map(c => c.user_id)
    ))
    return NextResponse.json({ ok: true, holders })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
