// Phase 4-A: 회원 CRM 집계 재계산 엔진 (서버 전용 · 서비스롤)
// 기존 B-2 버그(익명키 users UPDATE가 RLS로 조용히 실패) 해결 — 서버에서 재계산해 확실히 반영한다.
// 원칙: 증분이 아니라 '주문 테이블에서 통째로 재계산'(멱등) — 중복 카운트 없고 과거 드리프트도 자동 교정.
import type { SupabaseClient } from '@supabase/supabase-js'

// '완료 주문'으로 카운트하는 상태 (미결제 pending/cash_pending, canceled, verification_failed 제외) — D5
const COUNTED = ['paid', 'accepted', 'cooking', 'done', 'served', 'out_for_delivery', 'delivered']

// KST(UTC+9) 기준 날짜 문자열 YYYY-MM-DD — closed_at 없는 레거시/진행중 주문의 방문 판정 폴백
function kstDate(iso: string) {
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

// A2: 방문(visit) = '결제완료(세션 마감)' 1회. 같은 테이블 주문들이 한 번의 결제로 닫히면 같은 closed_at을 공유하므로
// distinct closed_at = 세션 수 = 방문 수. closed_at이 없는 주문(진행중·레거시)은 주문일(kstDate)로 폴백해 근사한다.
function visitKey(o: { closed_at?: string | null; created_at: string }) {
  return o.closed_at ? `s:${o.closed_at}` : `d:${kstDate(o.created_at)}`
}

// CRM 내부 등급(신규/일반/단골/VIP). A2: 주문 row 수가 아니라 '방문 횟수' 기준(한 자리 다회주문이 등급을 부풀리지 않게).
function tierOf(visitCount: number, totalSpent: number) {
  if (visitCount >= 10 || totalSpent >= 300000) return 'vip'
  if (visitCount >= 5) return 'regular'
  if (visitCount >= 2) return 'normal'
  return 'new'
}

// 고객 화면 로열티 배지용 기존 등급(bronze/silver/gold) — 방문횟수 기준, 스킴 그대로 유지(D1). 오래 멈춰있던 값이 이제 실제로 갱신된다.
function legacyGrade(visitCount: number) {
  if (visitCount >= 10) return 'gold'
  if (visitCount >= 5) return 'silver'
  return 'bronze'
}

export async function recomputeCustomer(admin: SupabaseClient, userId: string) {
  // closed_at을 함께 조회(세션 방문 판정용). 컬럼 미존재 마이그레이션 전 환경에서도 깨지지 않게 폴백 조회.
  let list: { final_amount: number; created_at: string; status: string; closed_at?: string | null }[] = []
  const withClosed = await admin.from('orders')
    .select('final_amount, created_at, status, closed_at')
    .eq('user_id', userId).in('status', COUNTED)
  if (withClosed.error) {
    const fallback = await admin.from('orders')
      .select('final_amount, created_at, status')
      .eq('user_id', userId).in('status', COUNTED)
    list = fallback.data || []
  } else {
    list = withClosed.data || []
  }

  const totalOrderCount = list.length
  const totalSpent = list.reduce((a, o) => a + (o.final_amount || 0), 0)
  const avg = totalOrderCount ? Math.round(totalSpent / totalOrderCount) : 0
  const times = list.map(o => o.created_at).filter(Boolean).sort()
  const firstOrderAt = times[0] || null
  const lastOrderAt = times[times.length - 1] || null
  const visitCount = new Set(list.map(visitKey)).size // A2: 결제세션(closed_at) 단위 방문 수 (폴백=주문일)
  const lastVisit = lastOrderAt ? kstDate(lastOrderAt) : null

  await admin.from('users').update({
    total_order_count: totalOrderCount,
    total_spent: totalSpent,
    average_order_amount: avg,
    visit_count: visitCount,
    first_order_at: firstOrderAt,
    last_order_at: lastOrderAt,
    last_visit: lastVisit,
    customer_grade: tierOf(visitCount, totalSpent),
    grade: legacyGrade(visitCount),
  }).eq('id', userId)

  return { totalOrderCount, totalSpent, avg, visitCount, lastVisit,
    customerGrade: tierOf(visitCount, totalSpent), grade: legacyGrade(visitCount) }
}
