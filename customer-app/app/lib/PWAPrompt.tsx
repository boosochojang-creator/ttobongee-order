'use client'
import { useEffect, useState } from 'react'

export default function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('pwa-prompt-done')) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler as EventListener)
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener)
  }, [])

  const dismiss = () => {
    localStorage.setItem('pwa-prompt-done', '1')
    setShow(false)
  }

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    localStorage.setItem('pwa-prompt-done', '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      zIndex: 9999,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1c1c1c',
        borderRadius: '20px 20px 0 0',
        borderTop: '2px solid #c8a900',
        padding: '28px 24px 44px',
        width: '100%', maxWidth: 480,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <img src="/icon-192.png" alt="아이콘"
            style={{ width: 56, height: 56, borderRadius: 14 }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#f0f0f0' }}>
              또봉이백운역점
            </div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
              홈 화면에 아이콘을 추가하시겠습니까?
            </div>
          </div>
        </div>
        <p style={{ fontSize: 14, color: '#bbb', lineHeight: 1.7, marginBottom: 22 }}>
          홈 화면에 추가하면 앱처럼 빠르게 실행할 수 있습니다.<br />
          추가하지 않아도 모든 기능은 동일하게 이용 가능합니다.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={dismiss}
            style={{
              flex: 1, padding: '14px',
              background: 'none', color: '#888',
              fontSize: 15, border: '1px solid #333',
              borderRadius: 12, cursor: 'pointer',
            }}
          >
            아니오
          </button>
          <button
            onClick={install}
            style={{
              flex: 2, padding: '14px',
              background: '#c8a900', color: '#111',
              fontSize: 15, fontWeight: 700,
              border: 'none', borderRadius: 12, cursor: 'pointer',
            }}
          >
            예, 추가할게요
          </button>
        </div>
      </div>
    </div>
  )
}
