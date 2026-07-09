// [7] 포장 예약시간 유틸 (순수 — 테스트 가능)

// 'HH:MM'(KST) → 오늘 날짜 기준 ISO. 형식 오류면 null(예약 없음).
export function pickupIso(hhmm: string, now = Date.now()): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) return null
  const dateStr = new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10) // KST 오늘
  const d = new Date(`${dateStr}T${hhmm}:00+09:00`)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// 예약시각이 지금부터 windowMs(기본 15분) 이내로 임박했는지 (이미 지난 건 false).
export function isPickupImminent(pickupAtIso: string | null | undefined, now = Date.now(), windowMs = 15 * 60 * 1000): boolean {
  if (!pickupAtIso) return false
  const diff = new Date(pickupAtIso).getTime() - now
  return diff > 0 && diff <= windowMs
}
