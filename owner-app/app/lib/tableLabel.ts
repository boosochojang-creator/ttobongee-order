// 테이블 표시 이름 — QR 번호(table_no)는 그대로 두고 '보이는 이름'만 여기서 정한다(QR 스티커 재부착 불필요).
// 2026-10: 8번 = 예전 '외부1' 자리 → 그냥 '8번', 9번 = 예전 '외부2' 자리 → '외부1'.
// 손님·점주 화면, 음성, 통계, 영수증이 모두 이 함수 하나를 쓴다(손님앱·점주앱에 같은 내용으로 존재).
const CUSTOM_NAMES: Record<number, string> = { 9: '외부1' }

// tableLabel(3) → '3번', tableLabel(3, true) → '3번 테이블', tableLabel(9) → '외부1', tableLabel(9, true) → '외부1 테이블'
export function tableLabel(no: number | string | null | undefined, withSuffix = false): string {
  const n = typeof no === 'number' ? no : parseInt(String(no ?? ''), 10)
  if (!Number.isInteger(n) || n <= 0) return withSuffix ? '자리 미지정' : '-'
  const custom = CUSTOM_NAMES[n]
  if (custom) return withSuffix ? `${custom} 테이블` : custom
  return withSuffix ? `${n}번 테이블` : `${n}번`
}
