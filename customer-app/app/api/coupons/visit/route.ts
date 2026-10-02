import { NextRequest, NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { adminClient } from '../../../lib/supabaseAdmin'
import { ensureVisitCoupon } from '../../../lib/visitCoupon'

// [2026-10] 5번째 방문 감사 쿠폰 — 손님이 매장에 착석해 주문 화면에 들어오면 호출.
// 조건(영업 중·5의 배수 방문·중복 아님)을 서버가 판정해 발급하고, 발급됐으면 손님 화면이 팝업+음성으로 안내한다.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  noStore()
  try {
    const b = await req.json().catch(() => ({}))
    const userId = typeof b.userId === 'string' ? b.userId : ''
    const storeId = typeof b.storeId === 'string' ? b.storeId : ''
    if (!userId || !storeId) return NextResponse.json({ ok: false, error: 'userId/storeId 필요' }, { status: 400 })
    const r = await ensureVisitCoupon(adminClient(), userId, storeId)
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
