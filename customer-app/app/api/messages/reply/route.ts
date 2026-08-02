import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '../../../lib/supabaseAdmin'

// [항목6-③] 손님 → 사장님 답장. (사장님은 점주앱 회원목록/스레드에서 확인)
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId, storeId, body } = await req.json()
    const text = String(body || '').trim().slice(0, 500)
    if (!userId || !text) return NextResponse.json({ ok: false, error: '내용을 입력해주세요' }, { status: 400 })
    const sid = storeId || 'baegun'
    const admin = adminClient()
    // 본인 확인(미탈퇴 회원만)
    const { data: u } = await admin.from('users').select('id, withdrawn_at').eq('id', userId).eq('store_id', sid).maybeSingle()
    if (!u || (u as any).withdrawn_at) return NextResponse.json({ ok: false, error: '회원 확인이 필요해요' }, { status: 403 })
    const { error } = await admin.from('messages').insert({ store_id: sid, user_id: userId, sender: 'customer', body: text })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
