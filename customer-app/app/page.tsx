'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useCart, CART_STORAGE_KEY } from './lib/cartStore'
import { DEFAULT_STORE } from './lib/storeContext'
import { getMemberLocal } from './lib/memberState'

function Home() {
  const router = useRouter()
  const params = useSearchParams()
  const { clearItems, setTableNo, setOrderType } = useCart()

  useEffect(() => {
    // [고객상태 ④] 진입 경로 구분 (B-1):
    //   ?table=N  = 테이블 QR      → 그 테이블(매장)로 바로 메뉴
    //   ?qr=1     = 입구 QR(재인쇄) → 매장/포장 첫 화면(/entry)
    //   파라미터 없음 = 즐겨찾기/PWA 직접진입 → 재방문(known)이면 메뉴, 신규(guest)면 로그인
    const table = params.get('table')
    const qr = params.get('qr')
    if (table && table !== '0') {
      // 저장된 이전 장바구니도 제거(새 손님이 물려받지 않게)
      try { localStorage.removeItem(CART_STORAGE_KEY) } catch {}
      clearItems()
      setTableNo(table)
      setOrderType('dine_in')
      router.replace(`/store/${DEFAULT_STORE}/menu`)
    } else if (qr) {
      router.replace(`/store/${DEFAULT_STORE}/entry`)
    } else {
      const known = !!getMemberLocal()
      router.replace(`/store/${DEFAULT_STORE}/${known ? 'menu' : 'login'}`)
    }
  }, [])

  return null
}

export default function Page() {
  return <Suspense><Home /></Suspense>
}
