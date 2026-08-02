import { NextResponse } from 'next/server'
import { adminClient } from '../../../lib/supabaseAdmin'
import { STORE_ID } from '../../../lib/store'

// [항목6-③] 점주 — 답장 안 읽은(손님 발신 read_at null) 회원 id 목록. 회원목록 뱃지용.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const admin = adminClient()
    const { data } = await admin.from('messages')
      .select('user_id')
      .eq('store_id', STORE_ID).eq('sender', 'customer').is('read_at', null)
    const userIds = Array.from(new Set((data || []).map((m: any) => m.user_id)))
    return NextResponse.json({ ok: true, userIds })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
