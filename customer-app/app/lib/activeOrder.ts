// 그룹 C: 진행 중인 주문 추적 (팝업/음성 안내용)
// 주문 생성 시 기록해 두면 OrderWatcher가 어느 화면에서든 상태 변화를 감시한다.

const KEY = 'ttobongee-active-order'
const MAX_AGE_MS = 2 * 60 * 60 * 1000 // 2시간 (한 끼 세션 기준)

export function setActiveOrder(orderId: string) {
  try { localStorage.setItem(KEY, JSON.stringify({ orderId, createdAt: Date.now() })) } catch {}
}

export function getActiveOrder(): { orderId: string } | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (!o?.orderId) return null
    if (Date.now() - (o.createdAt || 0) > MAX_AGE_MS) {
      localStorage.removeItem(KEY)
      return null
    }
    return o
  } catch { return null }
}

export function clearActiveOrder() {
  try { localStorage.removeItem(KEY) } catch {}
}
