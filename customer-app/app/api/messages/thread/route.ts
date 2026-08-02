import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '../../../lib/supabaseAdmin'

// [항목6-③] 손님 — 사장님과의 메시지 스레드 조회 + 사장님 발신 읽음처리.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId, storeId } = await req.json()
    if (!userId) return NextResponse.json({ ok: false, error: 'userId 필요' }, { status: 400 })
    const sid = storeId || 'baegun'
    const admin = adminClient()
    const { data } = await admin.from('messages')
      .select('id, sender, body, created_at, read_at')
      .eq('store_id', sid).eq('user_id', userId).order('created_at', { ascending: true })
    // 손님이 열람 → 사장님(owner) 발신 미읽음 read 처리
    try {
      await admin.from('messages').update({ read_at: new Date().toISOString() })
        .eq('store_id', sid).eq('user_id', userId).eq('sender', 'owner').is('read_at', null)
    } catch {}
    return NextResponse.json({ ok: true, messages: data || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
