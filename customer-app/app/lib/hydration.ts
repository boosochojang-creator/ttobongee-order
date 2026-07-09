// 앱 진입 시 localStorage에서 장바구니 + 회원상태를 복원하는 순수 로직 (컴포넌트와 분리 → 테스트 가능).
// 버그[1] 수정 핵심: 회원상태(MEMBER_KEY)는 "사람 자체"의 영속 정보라, 테이블 재진입(QR 재스캔)이어도 항상 복원한다.
// (장바구니는 한 끼 세션이라 새 테이블 진입 시 복원하지 않지만, 회원 인식은 그와 무관해야 한다.)

export const CART_STORAGE_KEY = 'ttobongee-cart-v1'
export const CART_MAX_AGE_MS = 3 * 60 * 60 * 1000 // 장바구니 유효시간 3시간 (어제 담은 게 오늘 살아나지 않도록)

export type CartItem = { id: number; name: string; price: number; qty: number }

export type HydrationResult = {
  items: CartItem[]
  tableNo: string | null
  orderType: string | null
  isMember: boolean
  userId: string | null
  phone: string
}

// isNewTableEntry: QR로 새 테이블 진입(?table=) 여부.
export function computeHydration(opts: {
  cartRaw: string | null
  memberRaw: string | null
  isNewTableEntry: boolean
  now?: number
}): HydrationResult {
  const now = opts.now ?? Date.now()
  const res: HydrationResult = { items: [], tableNo: null, orderType: null, isMember: false, userId: null, phone: '' }

  // 1) 장바구니 복원 — 새 테이블 진입이면 새 세션이므로 복원 안 함 + 유효시간(3h) 내에서만
  if (opts.cartRaw && !opts.isNewTableEntry) {
    try {
      const saved = JSON.parse(opts.cartRaw)
      if (saved && now - (saved.savedAt || 0) < CART_MAX_AGE_MS) {
        if (Array.isArray(saved.items)) res.items = saved.items
        if (saved.tableNo) res.tableNo = saved.tableNo
        if (saved.orderType) res.orderType = saved.orderType
      }
    } catch {}
  }

  // 2) 회원 자동복원 — MEMBER_KEY는 영속. 테이블 재진입 여부와 무관하게 항상 복원 (버그[1] 수정)
  if (opts.memberRaw) {
    try {
      const m = JSON.parse(opts.memberRaw)
      if (m && m.userId) {
        res.isMember = true
        res.userId = m.userId
        res.phone = m.phone || ''
      }
    } catch {}
  }

  return res
}
