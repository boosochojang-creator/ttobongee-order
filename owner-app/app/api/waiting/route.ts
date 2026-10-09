import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '../../lib/supabaseAdmin'
import { STORE_ID } from '../../lib/store'
import { listWaiting, setWaitingOn, actWaiting } from '../../lib/waiting.server'

// [1] 점주 웨이팅 관리 (점주 출입증 필요: middleware)
//  GET  → 오늘 웨이팅 목록·켜짐 여부·팀 수
//  POST { action:'toggle', on } | { action:'call'|'seat'|'noshow'|'cancel'|'back', id }
export const dynamic = 'force-dynamic'

export async function GET() {
  try { return NextResponse.json({ ok: true, storeId: STORE_ID, ...(await listWaiting(adminClient(), STORE_ID)) }) }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const admin = adminClient()
    if (b.action === 'toggle') { await setWaitingOn(admin, STORE_ID, !!b.on); return NextResponse.json({ ok: true }) }
    if (!b.id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 })
    const r = await actWaiting(admin, STORE_ID, String(b.id), String(b.action))
    return NextResponse.json(r, { status: r.ok ? 200 : 400 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
