import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '../../../lib/pushSend'
import { STORE_ID } from '../../../lib/store'

// [항목2-부속] 웹푸시 임의 발송 — 일괄(이벤트)/개별(경고).
//  kind='event'  : 이벤트/공지. 수신동의(marketing_opt_in=true)자만 발송.
//  kind='warning': 개별 경고. 운영 목적이라 수신동의 무관하게 발송.
// 발송 후 push_logs에 이력 기록. 구독 없는 회원은 조용히 skip(에러 아님).
export async function POST(req: NextRequest) {
  try {
    const { userIds, kind, target, title, body, url } = await req.json()
    if (!title || !body) return NextResponse.json({ ok: false, error: '제목과 내용을 입력해주세요' }, { status: 400 })
    if (!Array.isArray(userIds) || userIds.length === 0) return NextResponse.json({ ok: false, error: '발송 대상이 없어요' }, { status: 400 })
    if (kind !== 'event' && kind !== 'warning') return NextResponse.json({ ok: false, error: 'kind 오류' }, { status: 400 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    let targets: string[] = userIds
    // 이벤트성 일괄 발송은 수신동의자만 (경고성은 동의 무관)
    if (kind === 'event') {
      const { data } = await admin.from('users').select('id, marketing_opt_in').in('id', userIds)
      const ok = new Set((data || []).filter((u: any) => u.marketing_opt_in).map((u: any) => u.id))
      targets = userIds.filter((id: string) => ok.has(id))
    }

    let reached = 0, skipped = 0, failed = 0
    for (const uid of targets) {
      try {
        const r = await sendPushToUser(admin, {
          storeId: STORE_ID, userId: uid,
          payload: { title, body, url: url || `/store/${STORE_ID}/profile`, tag: kind === 'warning' ? 'warn' : 'event' },
        })
        if (r.sent > 0) reached++; else skipped++
      } catch { failed++ }
    }

    // 발송 이력 기록 (best-effort — push_logs 없어도 발송은 유지)
    try {
      await admin.from('push_logs').insert({
        store_id: STORE_ID, kind, target: target || 'unknown',
        title, body, sent_count: reached, skipped_count: skipped, failed_count: failed,
      })
    } catch {}

    return NextResponse.json({ ok: true, reached, skipped, failed, excluded: userIds.length - targets.length })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
