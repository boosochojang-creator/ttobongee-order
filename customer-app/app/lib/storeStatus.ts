// [2] 영업상태 — 고객 화면에서 영업중/마감 판정.
// 원칙(fail-open): 명시적으로 is_open=false 일 때만 '마감'. null/undefined/컬럼없음/조회실패는 '영업중'으로 간주.
// (stores.is_open 마이그레이션 전에는 조회가 실패하므로, 이 원칙 덕분에 주문을 잘못 막지 않는다.)

export function isStoreClosed(row: { is_open?: boolean | null } | null | undefined): boolean {
  return row?.is_open === false
}

// 주문 가능 여부(마감이 아니면 가능). 제출 시점 하드가드와 배너 모두 이 판정을 사용.
// supabase는 함수 내부 동적 import — 순수 isStoreClosed를 테스트에서 격리해 불러올 수 있게.
export async function fetchStoreClosed(storeId = 'baegun'): Promise<boolean> {
  try {
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase.from('stores').select('is_open').eq('id', storeId).single()
    if (error) return false // 컬럼 미존재/조회 실패 → 영업중 간주(주문 막지 않음)
    return isStoreClosed(data)
  } catch {
    return false
  }
}
