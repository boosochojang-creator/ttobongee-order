// 더치페이 재설계: 결제자 1명이 전액 결제, 1/N은 '안내 숫자'로만 표시.
// (세션/개별 몫 결제 없음 → 부분결제 사각지대·유령주문 등 구조적 버그 원천 제거.)

export function validateSplitCount(n: number): boolean {
  return Number.isInteger(n) && n >= 2 && n <= 20
}

// 1인당 안내 금액 = 전체 결제금액 / 인원수 (원단위 절사). 실제 결제는 전액이며, 이 값은 참고용.
export function splitPerPerson(payTotal: number, n: number): number {
  if (!validateSplitCount(n)) return 0
  return Math.floor(payTotal / n)
}
