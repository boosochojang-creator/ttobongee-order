// Phase 4-B 쿠폰 자동발급 엔진 (서버 전용 · 서비스롤)
// 규칙은 템플릿 테이블 없이 하드코딩(4종 고정). 발급 인스턴스만 coupons 테이블에 저장.
import type { SupabaseClient } from '@supabase/supabase-js'

// 메뉴 무료 증정 방식 (금액할인 폐기). freeMenu 개수만큼 증정, validDays=null이면 무제한, sameDay=true면 발급 당일부터 사용가능(그 외는 다음날부터).
export const COUPON_RULES = {
  signup:     { label: '신규가입', freeMenu: '튀김만두',      freeQty: 5, minOrder: 0,     validDays: null, sameDay: false },
  birthday:   { label: '생일',     freeMenu: '감자튀김 200g', freeQty: 1, minOrder: 0,     validDays: 7,    sameDay: true  },
  winback:    { label: '재방문',   freeMenu: '튀김만두',      freeQty: 5, minOrder: 15000, validDays: 7,    sameDay: false },
  vip_thanks: { label: '단골감사', freeMenu: '튀김만두',      freeQty: 5, minOrder: 20000, validDays: 7,    sameDay: false },
} as const
export type CouponType = keyof typeof COUPON_RULES

// 더미/테스트 계정(전화번호) — 자동발급 제외. 추후 전체 재진단 때 정리 예정.
const EXCLUDE_PHONES = new Set(['01052636119', '01094706860', '010000000000'])

function daysSince(s?: string | null) {
  if (!s) return null
  const t = new Date(s).getTime()
  return isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000)
}
// 생일(월·일)이 오늘부터 within일 이내인지 (KST, 연도 무관)
function birthdayWithin(bday: string | null | undefined, within: number) {
  if (!bday) return false
  const d = new Date(bday); if (isNaN(d.getTime())) return false
  const bkey = (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
  const now = new Date(Date.now() + 9 * 3600 * 1000)
  for (let i = 0; i <= within; i++) {
    const t = new Date(now.getTime() + i * 86400000)
    if ((t.getUTCMonth() + 1) * 100 + t.getUTCDate() === bkey) return true
  }
  return false
}
function kstTodayStartIso() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000)
  const d = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`
  return `${d}T00:00:00+09:00`
}
// 다음 KST 자정(내일 00:00 KST)을 UTC instant로
function nextKstMidnight(now: Date) {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000)
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1, 0, 0, 0) - 9 * 3600 * 1000)
}
function newCoupon(userId: string, type: CouponType, now: Date) {
  const r = COUPON_RULES[type]
  const expires = r.validDays == null
    ? new Date(now.getTime() + 100 * 365 * 86400000)          // 무제한(신규가입) — 100년 후
    : new Date(now.getTime() + r.validDays * 86400000)
  const usableFrom = r.sameDay ? now : nextKstMidnight(now)   // 생일=당일, 나머지=다음날부터
  return {
    user_id: userId, type,
    discount_amount: 0,                                       // 금액할인 폐기 → 0 (컬럼은 이력보존용으로 유지)
    free_menu: r.freeMenu, free_qty: r.freeQty,
    min_order_amount: r.minOrder,
    status: 'active', issued_at: now.toISOString(),
    usable_from: usableFrom.toISOString(),
    expires_at: expires.toISOString(),
  }
}

// 자동발급 실행: ① 만료 전환 ② 조건 스캔·발급(중복방지) ③ 오늘(KST) 발급분 반환(팝업용)
// 중복방지: signup은 '최초 1회'(한 번이라도 발급된 적 있으면 스킵), 나머지는 '유효(active·미만료) 보유 시 스킵'
export async function runCouponAutomation(admin: SupabaseClient) {
  const now = new Date()
  const nowIso = now.toISOString()

  const { data: expired } = await admin.from('coupons').update({ status: 'expired' })
    .eq('status', 'active').lt('expires_at', nowIso).select('id')

  const { data: users } = await admin.from('users')
    .select('id, phone, nickname, birthday, customer_grade, last_visit, total_order_count').eq('store_id', 'baegun')
  const { data: existing } = await admin.from('coupons').select('user_id, type, status, expires_at')

  const everSignup = new Set<string>()
  const activeUT = new Set<string>() // `${user_id}|${type}` — active & 미만료
  for (const c of existing || []) {
    if (c.type === 'signup') everSignup.add(c.user_id)
    if (c.status === 'active' && new Date(c.expires_at).getTime() > now.getTime()) activeUT.add(`${c.user_id}|${c.type}`)
  }
  const has = (uid: string, t: string) => activeUT.has(`${uid}|${t}`)

  const toIssue: ReturnType<typeof newCoupon>[] = []
  for (const u of users || []) {
    if (EXCLUDE_PHONES.has(u.phone)) continue                                                     // 더미/테스트 계정 제외
    if (!everSignup.has(u.id)) toIssue.push(newCoupon(u.id, 'signup', now))                       // 전화 가입완료 = 최초 1회
    if (birthdayWithin(u.birthday, 7) && !has(u.id, 'birthday')) toIssue.push(newCoupon(u.id, 'birthday', now))
    const days = daysSince(u.last_visit)
    if ((u.customer_grade === 'regular' || u.customer_grade === 'vip') && (u.total_order_count || 0) > 0
      && days !== null && days >= 30 && !has(u.id, 'winback')) toIssue.push(newCoupon(u.id, 'winback', now))
    if (u.customer_grade === 'vip' && !has(u.id, 'vip_thanks')) toIssue.push(newCoupon(u.id, 'vip_thanks', now))
  }
  if (toIssue.length) await admin.from('coupons').insert(toIssue)

  // 오늘(KST) 발급된 쿠폰 전체를 회원명과 함께 반환 (여러 번 눌러도 '오늘 발급분'을 일관되게 표시)
  const { data: todays } = await admin.from('coupons')
    .select('type, free_menu, free_qty, user_id').gte('issued_at', kstTodayStartIso())
  const nameOf = new Map((users || []).map(u => [u.id, u.nickname || u.phone]))
  const todayIssued = (todays || []).map(c => ({
    who: nameOf.get(c.user_id) || c.user_id,
    label: COUPON_RULES[c.type as CouponType]?.label || c.type,
    gift: c.free_qty && c.free_qty > 1 ? `${c.free_menu} ${c.free_qty}개` : (c.free_menu || '증정'),
  }))
  return { expiredCount: expired?.length || 0, issuedNow: toIssue.length, todayIssued }
}
