'use client'

// 서비스워커 등록 + 설치 이벤트 전역 캡처. 등록 실패해도 앱 동작에는 영향 없음.
import { useEffect } from 'react'
import { initPwaCapture } from './pwaInstall'

export default function SWRegister() {
  useEffect(() => {
    initPwaCapture()
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}
