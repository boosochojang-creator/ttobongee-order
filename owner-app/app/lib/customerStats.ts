// Phase 4-A: 회원 CRM 집계 재계산 엔진 (서버 전용 · 서비스롤)
// 기존 B-2 버그(익명키 users UPDATE가 RLS로 조용히 실패) 해결 — 서버에서 재계산해 확실히 반영한다.
// 원칙: 증분이 아니라 '주문 테이블에서 통째로 재계산'(멱등) — 중복 카운트 없고 과거 드리프트도 자동 교정.
import type { SupabaseClient } from '@supabase/supabase-js'

// '완료 주문'으로 카운트하는 상태 (미결제 pending/cash_pending, canceled, verification_failed 제외) — D5
const COUNTED = ['paid', 'accepted', 'cooking', 'done', 'served']

// KST(UTC+9) 기준 날짜 문자열 YYYY-MM-DD — '같은 날 여러 주문 = 방문 1회' 판정용
function kstDate(iso: string) {
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

// CRM 내부 등급(신규/일반/단골/VIP). 휴면/휴면주의는 저장하지 않고 조회 시 last_visit로 계산 — D2
function tierOf(orderCount: number, totalSpent: number) {
  if (orderCount >= 10 || totalSpent >= 300000) return 'vip'
  if (orderCount >= 5) return 'regular'
  if (orderCount >= 2) return 'normal'
  return 'new'
}

// 고객 화면 로열티 배지용 기존 등급(bronze/silver/gold) — 방문횟수 기준, 스킴 그대로 유지(D1). 오래 멈춰있던 값이 이제 실제로 갱신된다.
function legacyGrade(visitCount: number) {
  if (visitCount >= 10) return 'gold'
  if (visitCount >= 5) return 'silver'
  return 'bronze'
}

export async function recomputeCustomer(admin: SupabaseClient, userId: string) {
  const { data: orders } = await admin.from('orders')
    .select('final_amount, created_at, status')
    .eq('user_id', userId).in('status', COUNTED)
  const list = orders || []

  const totalOrderCount = list.length
  const totalSpent = list.reduce((a, o) => a + (o.final_amount || 0), 0)
  const avg = totalOrderCount ? Math.round(totalSpent / totalOrderCount) : 0
  const times = list.map(o => o.created_at).filter(Boolean).sort()
  const firstOrderAt = times[0] || null
  const lastOrderAt = times[times.length - 1] || null
  const visitCount = new Set(list.map(o => kstDate(o.created_at))).size // 방문일 distinct
  const lastVisit = lastOrderAt ? kstDate(lastOrderAt) : null

  await admin.from('users').update({
    total_order_count: totalOrderCount,
    total_spent: totalSpent,
    average_order_amount: avg,
    visit_count: visitCount,
    first_order_at: firstOrderAt,
    last_order_at: lastOrderAt,
    last_visit: lastVisit,
    customer_grade: tierOf(totalOrderCount, totalSpent),
    grade: legacyGrade(visitCount),
  }).eq('id', userId)

  return { totalOrderCount, totalSpent, avg, visitCount, lastVisit,
    customerGrade: tierOf(totalOrderCount, totalSpent), grade: legacyGrade(visitCount) }
}
