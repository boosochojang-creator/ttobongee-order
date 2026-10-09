import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '../../../lib/pushSend'
import { STORE_ID } from '../../../lib/store'

// [항목6] 웹푸시 3종 체계 — push_logs.kind로 구분:
//  ① 'event'  : 일괄발송(이벤트/공지) = 이 라우트. 광고성 → 수신동의(marketing_opt_in=true)자만. (야간 21~08 제한은 발송화면 안내)
//  ② 'personal': 개인 1:1(양방향·답장). → /api/messages/* (messages 테이블). ※ 구 단방향 'warning'을 대체함.
//  ③ 'system' : 시스템 자동발송(쿠폰/영수증). coupons.ts·send-receipt에서 기록.
// 이 라우트는 ①(일괄·이벤트)만 담당. 발송 후 push_logs 기록. 구독 없는 회원은 조용히 skip(에러 아님).
export async function POST(req: NextRequest) {
  try {
    const { userIds, target, title, body, url } = await req.json()
    if (!title || !body) return NextResponse.json({ ok: false, error: '제목과 내용을 입력해주세요' }, { status: 400 })
    if (!Array.isArray(userIds) || userIds.length === 0) return NextResponse.json({ ok: false, error: '발송 대상이 없어요' }, { status: 400 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // 일괄(광고성) → 수신동의자만
    const { data } = await admin.from('users').select('id, marketing_opt_in').in('id', userIds)
    const ok = new Set((data || []).filter((u: any) => u.marketing_opt_in).map((u: any) => u.id))
    const targets: string[] = userIds.filter((id: string) => ok.has(id))

    let reached = 0, skipped = 0, failed = 0
    for (const uid of targets) {
      try {
        const r = await sendPushToUser(admin, {
          storeId: STORE_ID, userId: uid,
          payload: { title, body, url: url || `/store/${STORE_ID}/profile`, tag: 'event' },
        })
        if (r.sent > 0) reached++; else skipped++
      } catch { failed++ }
    }

    // 발송 이력 기록 (best-effort — push_logs 없어도 발송은 유지)
    try {
      await admin.from('push_logs').insert({
        store_id: STORE_ID, kind: 'event', target: target || 'unknown',
        title, body, sent_count: reached, skipped_count: skipped, failed_count: failed,
      })
    } catch {}

    // [2026-10 어울장] 이벤트 알림을 보냈다는 사실을 어울장 운영자 휴대폰에 알림(운영자가 어울장 전체 홍보 검토).
    //  손님 발송에는 영향 없음(best-effort, 실패해도 무시).
    try { await notifyOperators(admin, title, reached) } catch {}

    return NextResponse.json({ ok: true, reached, skipped, failed, excluded: userIds.length - targets.length })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

async function notifyOperators(admin: any, title: string, reached: number) {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return
  const { data } = await admin.from('eoul_push_devices').select('endpoint, p256dh, auth').eq('role', 'operator')
  if (!data?.length) return
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:boosochojang@naver.com', pub, priv)
  const body = JSON.stringify({ title: '📣 매장 이벤트 알림 발송', body: `[또봉이통닭 백운역점] ${title} — ${reached}명에게 보냄. 어울장 전체 홍보를 검토해 보세요.`, url: 'https://market-pickup-owner.vercel.app/admin?tab=push', tag: 'op-ttobongee' })
  await Promise.all(data.map((d: any) => webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, body).catch(() => {})))
}
