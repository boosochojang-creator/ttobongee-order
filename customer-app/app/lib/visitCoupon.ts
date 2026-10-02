// [2026-10 쿠폰 개편] 5번째 방문 감사 쿠폰 — 5·10·15·20…번째 방문마다 발급, 발급 즉시(그 영업일) 사용.
// 기존 쿠폰(신규가입·생일·재방문·단골감사·계정연결)은 신규 발급 중단(이미 발급분은 그대로 사용 가능).
// 서버 전용(서비스롤). 손님이 매장에 착석(QR/자리선택)해 주문 화면에 들어온 순간 호출된다.
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushToUser } from './pushSend'

export const VISIT_COUPON_TYPE = 'visit5'
export const VISIT_COUPON_EVERY = 5
export const VISIT_COUPON_MENU = '소주 1병 / 생맥주 500cc 중 택1'
// 이 시각 이후에 결제 완료된 방문만 센다(그 전 방문 횟수는 미적용 — 솔님 결정 2026-10-02). 배포일 기준.
export const VISIT_COUPON_START = '2026-10-02T00:00:00+09:00'

// 방문으로 세는 '완료 주문' 상태 (owner customerStats.COUNTED와 동일)
const COUNTED = ['paid', 'accepted', 'cooking', 'done', 'served', 'out_for_delivery', 'delivered']
// 더미/테스트 계정 — 발급 제외 (owner coupons.ts EXCLUDE_PHONES와 동일)
const EXCLUDE_PHONES = new Set(['01052636119', '01094706860', '010000000000'])

// 다음 자동마감 시각(KST 03:00). 쿠폰은 '그 영업일'까지만 유효 → 영업 마감과 함께 소멸.
function nextAutoClose(now: Date) {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000)
  let t = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 3, 0, 0) - 9 * 3600 * 1000
  if (t <= now.getTime()) t += 86400000
  return new Date(t)
}

export type VisitCouponResult =
  | { issued: true; couponId: string; visitNo: number }
  | { issued: false; reason: string; visitNo?: number }

export async function ensureVisitCoupon(admin: SupabaseClient, userId: string, storeId: string): Promise<VisitCouponResult> {
  // 1) 영업 중일 때만(매장에서 실제 방문 중) — 마감 후/집에서 둘러볼 땐 발급 안 함
  const { data: store } = await admin.from('stores').select('is_open').eq('id', storeId).maybeSingle()
  if (!store?.is_open) return { issued: false, reason: 'closed' }
  const { data: openDay } = await admin.from('daily_reports').select('start_time')
    .eq('store_id', storeId).not('start_time', 'is', null).is('end_time', null)
    .order('start_time', { ascending: false }).limit(1).maybeSingle()
  if (!openDay?.start_time) return { issued: false, reason: 'no_business_day' }
  const dayStart = new Date(openDay.start_time).getTime()

  // 2) 회원 확인 (탈퇴·더미 제외)
  const { data: user } = await admin.from('users').select('id, phone, withdrawn_at, store_id').eq('id', userId).maybeSingle()
  if (!user || user.withdrawn_at || user.store_id !== storeId) return { issued: false, reason: 'no_user' }
  if (user.phone && EXCLUDE_PHONES.has(user.phone)) return { issued: false, reason: 'excluded' }

  // 3) 기준일 이후 '결제 완료된 방문' 수 — 방문 = 테이블 결제완료 1회(closed_at 공유)
  const { data: orders } = await admin.from('orders').select('closed_at, created_at')
    .eq('user_id', userId).in('status', COUNTED).not('closed_at', 'is', null).gte('closed_at', VISIT_COUPON_START)
  const closedTimes = Array.from(new Set((orders || []).map(o => o.closed_at as string))).map(t => new Date(t).getTime())
  // 오늘(이 영업일) 이미 결제 완료된 방문이 있으면, 지금은 '그 방문'의 연장 → 새 방문으로 세지 않음(같은 날 재진입 악용 방지)
  if (closedTimes.some(t => t >= dayStart)) return { issued: false, reason: 'visited_today' }
  const visitNo = closedTimes.length + 1 // 지금 진행 중인 방문의 번호
  if (visitNo % VISIT_COUPON_EVERY !== 0) return { issued: false, reason: 'not_target', visitNo }

  // 4) 중복 방지 — 이 영업일에 이미 발급했거나, 지난 방문 이후 발급분을 이미 썼으면 스킵
  const lastClosed = closedTimes.length ? new Date(Math.max(...closedTimes)).toISOString() : VISIT_COUPON_START
  const { data: prev } = await admin.from('coupons').select('id, status, issued_at')
    .eq('user_id', userId).eq('type', VISIT_COUPON_TYPE).gte('issued_at', lastClosed)
  if ((prev || []).some(c => c.status === 'used' || new Date(c.issued_at).getTime() >= dayStart)) {
    return { issued: false, reason: 'already', visitNo }
  }

  // 5) 발급 — 즉시 사용 가능, 이 영업일(다음 03:00 자동마감)까지 유효
  const now = new Date()
  const { data: row, error } = await admin.from('coupons').insert({
    user_id: userId, type: VISIT_COUPON_TYPE,
    discount_amount: 0,
    free_menu: VISIT_COUPON_MENU, free_qty: 1,
    min_order_amount: 0,
    status: 'active', issued_at: now.toISOString(),
    usable_from: now.toISOString(), expires_at: nextAutoClose(now).toISOString(),
  }).select('id').single()
  if (error || !row) return { issued: false, reason: error?.message || 'insert_failed', visitNo }

  // 6) 휴대폰 알림(웹푸시) — 알림 허용 손님만. 실패해도 발급은 유지.
  try {
    await sendPushToUser(admin, {
      storeId, userId,
      payload: {
        title: `🎉 오늘 ${visitNo}번째 방문 감사 쿠폰!`,
        body: `${VISIT_COUPON_MENU} 무료 증정 — 오늘 주문 때 바로 사용하세요`,
        url: `/store/${storeId}/menu`, tag: 'coupon',
      },
    })
  } catch {}

  return { issued: true, couponId: row.id, visitNo }
}
