'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCart } from './lib/cartStore'
import { Suspense } from 'react'

function Home() {
  const router = useRouter()
  const params = useSearchParams()
  const { setTableNo, setOrderType } = useCart()

  useEffect(() => {
    const table = params.get('table')
    const type = params.get('type')
    if (table && table !== '0') {
      // 테이블 QR 직접 스캔 → 바로 메뉴
      setTableNo(table)
      setOrderType('dine_in')
      router.replace('/store/baegun/menu')
    } else {
      // 입구 QR → 테이블 선택
      router.replace('/store/baegun/table')
    }
  }, [])

  return null
}

export default function Page() {
  return <Suspense><Home /></Suspense>
}
