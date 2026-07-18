'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useCart, CART_STORAGE_KEY } from './lib/cartStore'
import { DEFAULT_STORE } from './lib/storeContext'

function Home() {
  const router = useRouter()
  const params = useSearchParams()
  const { clearItems, setTableNo, setOrderType } = useCart()

  useEffect(() => {
    const table = params.get('table')
    if (table && table !== '0') {
      // 테이블 QR 스캔 → 장바구니 초기화 후 바로 메뉴로 (팝업 없음)
      // 저장된 이전 장바구니도 함께 제거 (새 손님이 이전 손님 장바구니를 물려받지 않도록)
      try { localStorage.removeItem(CART_STORAGE_KEY) } catch {}
      clearItems()
      setTableNo(table)
      setOrderType('dine_in')
      router.replace(`/store/${DEFAULT_STORE}/menu`)
    } else {
      // 입구 QR / 직접 접속 → 기본 매장 테이블 선택 화면 (매장별 QR은 /store/{storeId}?table=N 로 진입)
      router.replace(`/store/${DEFAULT_STORE}/table`)
    }
  }, [])

  return null
}

export default function Page() {
  return <Suspense><Home /></Suspense>
}
