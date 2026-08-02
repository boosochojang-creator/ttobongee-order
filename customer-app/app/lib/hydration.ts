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

  // 1) 장바구니(담은 메뉴)만 복원 — 새 테이블 진입이면 새 세션이라 복원 안 함 + 유효시간(3h) 내에서만.
  //
  //   ★ [테이블 잔존 버그 수정] 테이블번호/주문유형(tableNo·orderType)은 '방문 맥락'이라
  //     앱 재실행 간에 복원하지 않는다. 예전엔 localStorage에 tableNo가 남아,
  //     QR로 2번 찍고 주문한 뒤 앱데이터를 지우고 아이콘으로 재진입해도 (설치형 PWA는 브라우저와
  //     저장소 파티션이 분리돼 안 지워짐) 2번 테이블이 되살아나 '자리 미선택인데 2번으로 직행'하는
  //     문제가 있었다. 이제 테이블은 QR(?table=) 또는 자리선택 화면에서만 정해지고, 그 외 진입은
  //     항상 table_no=0 → 체크아웃의 '주문 확정 게이트'가 매장/포장·자리선택을 강제한다.
  //   (같은 세션 SPA 이동은 React 상태가 유지되므로 영향 없음. 전체 새로고침 시에만 게이트를 한 번 더 거친다.)
  if (opts.cartRaw && !opts.isNewTableEntry) {
    try {
      const saved = JSON.parse(opts.cartRaw)
      if (saved && now - (saved.savedAt || 0) < CART_MAX_AGE_MS) {
        if (Array.isArray(saved.items)) res.items = saved.items
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
