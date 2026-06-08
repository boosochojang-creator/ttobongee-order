'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useCart } from './lib/cartStore'

function Home() {
  const router = useRouter()
  const params = useSearchParams()
  const { clearItems, setTableNo, setOrderType } = useCart()

  useEffect(() => {
    const table = params.get('table')
    if (table && table !== '0') {
      // 테이블 QR 스캔 → 장바구니 초기화 후 바로 메뉴로 (팝업 없음)
      clearItems()
      setTableNo(table)
      setOrderType('dine_in')
      router.replace('/store/baegun/menu')
    } else {
      // 입구 QR / 직접 접속 → 테이블 선택 화면
      router.replace('/store/baegun/table')
    }
  }, [])

  return null
}

export default function Page() {
  return <Suspense><Home /></Suspense>
}
