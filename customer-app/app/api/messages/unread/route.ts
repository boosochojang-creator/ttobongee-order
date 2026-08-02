import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '../../../lib/supabaseAdmin'

// [항목6-③] 손님 — 안 읽은 사장님 메시지 수(종뱃지용).
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    const sid = req.nextUrl.searchParams.get('storeId') || 'baegun'
    if (!userId) return NextResponse.json({ ok: true, unread: 0 })
    const admin = adminClient()
    const { count } = await admin.from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', sid).eq('user_id', userId).eq('sender', 'owner').is('read_at', null)
    return NextResponse.json({ ok: true, unread: count || 0 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
