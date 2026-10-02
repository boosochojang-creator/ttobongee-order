// [영업일 기준] '달력 자정'이 아니라 '영업 시작 ~ 마감(버튼 또는 03:00 자동)'을 하나의 영업일로 본다.
// 점주 주문목록·라이브매출·테이블 결제완료·자동마감이 모두 이 기준을 공유한다(자정 초기화 버그 수정).
import type { SupabaseClient } from '@supabase/supabase-js'

// 결제(정산) 전 진행 중인 주문 상태 — 영업일 경계와 무관하게 계속 보여야 하는 주문
export const OPEN_ORDER_STATUSES = ['paid', 'cash_pending', 'verification_failed', 'accepted', 'cooking', 'done', 'out_for_delivery']

// 마감 후 이 시간 안에는 '방금 끝난 영업일'을 계속 보여준다(마감 결과 확인용). 지나면 다음 영업 대기 상태.
export const CLOSED_DAY_VISIBLE_MS = 8 * 3600 * 1000

// 지금 기준 영업일 행: 열린 영업일(start 있고 end 없음) 우선, 없으면 최근 8시간 안에 마감된 영업일, 그것도 없으면 null.
export async function loadCurrentBusinessDay(client: SupabaseClient, storeId: string) {
  const { data } = await client.from('daily_reports').select('*')
    .eq('store_id', storeId).not('start_time', 'is', null)
    .order('start_time', { ascending: false }).limit(1).maybeSingle()
  if (!data) return null
  if (!data.end_time) return data
  return Date.now() - new Date(data.end_time).getTime() < CLOSED_DAY_VISIBLE_MS ? data : null
}

// 주문·매출 집계 시작 시각: 현재 영업일의 시작 시각. 영업일이 없으면 KST 오늘 0시(영업 전 대기 화면).
export async function loadBusinessStart(client: SupabaseClient, storeId: string): Promise<string> {
  const day = await loadCurrentBusinessDay(client, storeId)
  if (day?.start_time) return new Date(day.start_time).toISOString()
  const kst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  return new Date(`${kst}T00:00:00+09:00`).toISOString()
}

// 이 주문이 영업일(시작 시각 이후)에 속하는지 — 문자열 형식 차이(+00:00/Z) 없이 시각으로 비교
export function inBiz(createdAt: string, bizStart: string) {
  return new Date(createdAt).getTime() >= new Date(bizStart).getTime()
}
