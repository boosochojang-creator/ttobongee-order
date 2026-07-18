// [2] 웹푸시 발송 — 서버 전용(VAPID 비밀키). 구독자에게 push 발송, 만료 구독 정리, 구독 없으면 조용히 스킵.
import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

let configured = false
function ensureVapid(): boolean {
  if (configured) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@ttobongee.local', pub, priv)
  configured = true
  return true
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string }

// 특정 회원(user_id)의 모든 구독 기기로 발송. 반환: {sent, skipped}. 에러 던지지 않음(조용히 스킵).
export async function sendPushToUser(
  admin: SupabaseClient,
  opts: { storeId: string; userId?: string | null; payload: PushPayload }
): Promise<{ sent: number; skipped: boolean }> {
  try {
    if (!ensureVapid() || !opts.userId) return { sent: 0, skipped: true }
    const { data: subs } = await admin.from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('store_id', opts.storeId).eq('user_id', opts.userId)
    if (!subs || !subs.length) return { sent: 0, skipped: true }
    const body = JSON.stringify(opts.payload)
    let sent = 0
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body)
        sent++
      } catch (e: any) {
        // 만료/무효 구독(410 Gone, 404) → 조용히 삭제
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          try { await admin.from('push_subscriptions').delete().eq('id', s.id) } catch {}
        }
      }
    }
    return { sent, skipped: sent === 0 }
  } catch {
    return { sent: 0, skipped: true }
  }
}
