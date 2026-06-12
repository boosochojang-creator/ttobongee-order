'use client'

// v1.4: PWA 홈 화면 추가 유도 배너 비활성화
// 추후 회원/비회원 구분 기능 추가 시 재사용할 수 있도록 원본 구현을 주석으로 보존
/*
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function PWAPrompt() {
  const pathname = usePathname()
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true

    if (standalone) {
      localStorage.setItem('pwa-installed', '1')
      return
    }
    if (localStorage.getItem('pwa-installed') === '1') return
    if (sessionStorage.getItem('pwa-banner-dismissed') === '1') return

    const ios = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())
    if (ios) {
      setIsIOS(true)
      setShow(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler as EventListener)
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener)
  }, [])

  if (pathname !== '/store/baegun/table') return null
  if (!show) return null

  const dismiss = () => {
    sessionStorage.setItem('pwa-banner-dismissed', '1')
    setShow(false)
  }

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') localStorage.setItem('pwa-installed', '1')
    setShow(false)
  }

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)', maxWidth: 'calc(var(--max-w) - 32px)',
      zIndex: 250,
      background: '#1c1c1c', border: '1px solid #c8a900',
      borderRadius: 14, padding: '14px 16px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>📲</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', lineHeight: 1.6 }}>
            홈 화면에 추가하면 더 편하게 주문할 수 있어요!
          </div>
          {isIOS && (
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 6, lineHeight: 1.7 }}>
              Safari 하단 <span style={{ color: '#FFD700', fontWeight: 700 }}>공유 버튼</span> →{' '}
              <span style={{ color: '#FFD700', fontWeight: 700 }}>'홈 화면에 추가'</span>를 눌러주세요
            </div>
          )}
        </div>
        <button
          onClick={dismiss}
          style={{
            background: 'none', border: 'none', color: '#666',
            fontSize: 18, lineHeight: 1, padding: 2, cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
      {!isIOS && (
        <button
          onClick={install}
          style={{
            width: '100%', marginTop: 12, padding: '12px',
            background: '#c8a900', color: '#111',
            fontSize: 14, fontWeight: 700,
            border: 'none', borderRadius: 10, cursor: 'pointer',
          }}
        >
          홈 화면에 추가하기
        </button>
      )}
    </div>
  )
}
*/

export default function PWAPrompt() {
  return null
}
