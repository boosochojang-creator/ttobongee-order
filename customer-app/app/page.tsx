'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function Home() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const table = params.get('table')
    if (table && table !== '0') {
      // 테이블 QR 스캔 → 테이블 확인 화면 (로그인 세션 유지, 테이블은 재확인)
      router.replace(`/store/baegun/table?table=${table}`)
    } else {
      // 입구 QR / 직접 접속 → 테이블 선택
      router.replace('/store/baegun/table')
    }
  }, [])

  return null
}

export default function Page() {
  return <Suspense><Home /></Suspense>
}
