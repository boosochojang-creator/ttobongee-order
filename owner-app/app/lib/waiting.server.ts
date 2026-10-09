// [1] 웨이팅(줄서기) — 점주 서버 기능. 어울장·또봉이 점주앱이 같은 파일을 쓴다(같은 DB 테이블 waitlist).
//  손님은 입구 QR(어울장 손님앱 /store/<매장>/waiting)로 인원·이름을 넣고 대기번호를 받는다.
//  점주: 목록 보기 · 호출(손님 휴대폰 알림 + 손님 화면 소리/진동) · 입장 · 부재 · 취소 · 웨이팅 받기 켜기/끄기.
//  '차례 알림'은 손님이 요청한 안내라 광고가 아님(동의·야간 제한 대상 아님).
//  영업일 = 한국시간 새벽 5시 기준(자정 넘어 영업해도 번호가 이어짐).
import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

const KST = 9 * 3600 * 1000
export const bizDate = (now = Date.now()) => new Date(now + KST - 5 * 3600 * 1000).toISOString().slice(0, 10)

let vapid = false
function ensureVapid() {
  if (vapid) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:boosochojang@naver.com', pub, priv)
  vapid = true
  return true
}

export async function listWaiting(admin: SupabaseClient, storeId: string) {
  const [{ data: rows }, { data: store }] = await Promise.all([
    admin.from('waitlist').select('id, number, party_size, name, status, created_at, called_at, done_at, endpoint')
      .eq('store_id', storeId).eq('biz_date', bizDate()).order('number'),
    admin.from('stores').select('features').eq('id', storeId).maybeSingle(),
  ])
  const list = (rows || []).map((r: any) => ({ ...r, canNotify: !!r.endpoint, endpoint: undefined }))
  return {
    on: !!(store as any)?.features?.waiting,
    list,
    waiting: list.filter((r: any) => r.status === 'waiting').length,
    called: list.filter((r: any) => r.status === 'called').length,
    seated: list.filter((r: any) => r.status === 'seated').length,
  }
}

export async function setWaitingOn(admin: SupabaseClient, storeId: string, on: boolean) {
  const { data: s } = await admin.from('stores').select('features').eq('id', storeId).maybeSingle()
  if (!s) throw new Error('매장을 찾을 수 없어요')
  const features = { ...((s as any).features || {}), waiting: !!on }
  const { error } = await admin.from('stores').update({ features }).eq('id', storeId)
  if (error) throw error
}

// action: call(호출·다시 호출) | seat(입장) | noshow(부재) | cancel(취소) | back(대기로 되돌리기)
export async function actWaiting(admin: SupabaseClient, storeId: string, id: string, action: string) {
  const { data: row } = await admin.from('waitlist').select('*').eq('id', id).eq('store_id', storeId).maybeSingle()
  if (!row) return { ok: false, error: '웨이팅을 찾을 수 없어요' }
  const now = new Date().toISOString()
  const patch: Record<string, any> =
    action === 'call' ? { status: 'called', called_at: now } :
    action === 'seat' ? { status: 'seated', done_at: now } :
    action === 'noshow' ? { status: 'noshow', done_at: now } :
    action === 'cancel' ? { status: 'canceled', done_at: now } :
    action === 'back' ? { status: 'waiting', called_at: null, done_at: null } : {}
  if (!Object.keys(patch).length) return { ok: false, error: '알 수 없는 요청' }
  const { error } = await admin.from('waitlist').update(patch).eq('id', id)
  if (error) throw error
  let pushed = false
  const r = row as any
  if (action === 'call' && r.endpoint && r.p256dh && r.auth && ensureVapid()) {
    const { data: st } = await admin.from('stores').select('name, branch_name').eq('id', storeId).maybeSingle()
    const name = st ? `${(st as any).name}${(st as any).branch_name ? ' ' + (st as any).branch_name : ''}` : '매장'
    try {
      await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, JSON.stringify({
        title: `🔔 ${name} 입장 차례예요!`, body: `대기번호 ${r.number}번 손님, 지금 매장 입구로 와 주세요.`,
        url: `/store/${storeId}/waiting`, tag: `wait-${r.id}`, renotify: true, requireInteraction: true, vibrate: [300, 150, 300, 150, 300],
      }), { TTL: 600, urgency: 'high' })
      pushed = true
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from('waitlist').update({ endpoint: null, p256dh: null, auth: null }).eq('id', id)
    }
  }
  return { ok: true, pushed }
}
