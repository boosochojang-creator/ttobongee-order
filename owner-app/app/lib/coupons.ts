// 쿠폰 엔진 (서버 전용 · 서비스롤)
// [2026-10 쿠폰 개편] 자동발급 규칙 4종(신규가입·생일·재방문·단골감사) 신규 발급 중단.
//   이미 발급된 쿠폰은 그대로 사용 가능(약속된 혜택). 새 혜택 = '5번째 방문 감사'(visit5) 하나 —
//   발급은 손님앱 lib/visitCoupon.ts(손님이 매장 착석 시 즉시 발급·당일 사용)가 담당.
//   여기서는 ① 만료 전환 ② 오늘 발급분 조회(영업시작 팝업)만 한다.
import type { SupabaseClient } from '@supabase/supabase-js'
import { STORE_ID } from './store'

// 표시용 라벨·증정 문구 (과거 발급분 표시를 위해 옛 종류도 남겨 둠 — 새로 발급하지 않음)
export const COUPON_RULES = {
  visit5:     { label: '5번째 방문 감사', freeMenu: '소주 1병 / 생맥주 500cc 중 택1' },
  signup:     { label: '신규가입',        freeMenu: '' },
  birthday:   { label: '생일',            freeMenu: '' },
  revisit:    { label: '재방문 감사',     freeMenu: '' },
  vip_thanks: { label: '단골감사',        freeMenu: '' },
  connect:    { label: '계정연결',        freeMenu: '' },
} as const
export type CouponType = keyof typeof COUPON_RULES

function kstTodayStartIso() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000)
  const d = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`
  return `${d}T00:00:00+09:00`
}

// 영업시작 시 실행: ① 만료 전환 ② 오늘(KST) 발급분 반환(팝업용). 새 발급은 하지 않는다.
export async function runCouponAutomation(admin: SupabaseClient) {
  const nowIso = new Date().toISOString()

  const { data: expired } = await admin.from('coupons').update({ status: 'expired' })
    .eq('status', 'active').lt('expires_at', nowIso).select('id')

  const { data: users } = await admin.from('users')
    .select('id, phone, nickname')
    .eq('store_id', STORE_ID).is('withdrawn_at', null)
  const issuedCount = 0

  // 오늘(KST) 발급된 쿠폰을 회원명과 함께 반환 (여러 번 눌러도 '오늘 발급분'을 일관되게 표시)
  // 멀티매장: coupons엔 store_id가 없어 이 매장 회원(user_id)로 스코핑.
  const storeUserIds = (users || []).map(u => u.id)
  const { data: todays } = await admin.from('coupons')
    .select('type, free_menu, free_qty, user_id').gte('issued_at', kstTodayStartIso()).in('user_id', storeUserIds)
  const nameOf = new Map((users || []).map(u => [u.id, u.nickname || u.phone]))
  const todayIssued = (todays || []).map(c => ({
    who: nameOf.get(c.user_id) || c.user_id,
    label: COUPON_RULES[c.type as CouponType]?.label || c.type,
    gift: c.free_qty && c.free_qty > 1 ? `${c.free_menu} ${c.free_qty}개` : (c.free_menu || '증정'),
  }))
  return { expiredCount: expired?.length || 0, issuedNow: issuedCount, todayIssued }
}
