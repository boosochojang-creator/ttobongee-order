import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '../../../lib/supabaseAdmin'
import { sendPushToUser } from '../../../lib/pushSend'
import { STORE_ID } from '../../../lib/store'

// [항목6-③] 점주 → 손님 개인 1:1 메시지 발송(예: 사과/안내). messages 테이블 + 웹푸시 알림.
//   개인 CS 메시지라 수신동의 무관 발송. push_logs kind='personal'.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId, body } = await req.json()
    const text = String(body || '').trim().slice(0, 500)
    if (!userId || !text) return NextResponse.json({ ok: false, error: '대상과 내용을 입력해주세요' }, { status: 400 })
    const admin = adminClient()
    const { error } = await admin.from('messages').insert({ store_id: STORE_ID, user_id: userId, sender: 'owner', body: text })
    if (error) throw error
    // 웹푸시 알림(구독 있으면). 개인 CS라 수신동의 무관.
    const pr = await sendPushToUser(admin, {
      storeId: STORE_ID, userId,
      payload: { title: '💬 또봉이 사장님 메시지', body: text.slice(0, 80), url: `/store/${STORE_ID}/menu?msg=1`, tag: 'owner-message' },
    })
    try {
      await admin.from('push_logs').insert({
        store_id: STORE_ID, kind: 'personal', target: `user:${userId}`,
        title: '💬 개인메시지', body: text.slice(0, 120), sent_count: pr.sent, skipped_count: pr.skipped ? 1 : 0, failed_count: 0,
      })
    } catch {}
    return NextResponse.json({ ok: true, notified: pr.sent })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
