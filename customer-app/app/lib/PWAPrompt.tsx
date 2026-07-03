'use client'

// 홈 화면 설치 재안내 (그룹 A 보강판)
// - 비회원: 아무것도 안 띄움 (설치 유도는 회원가입 완료 흐름에서만 — login 페이지 참조)
// - 가입했는데 아직 설치 안 한 회원: 메뉴/테이블 화면 상단에 작은 재안내만 (강제 팝업 아님)
// - 설치 완료: 영구 숨김 / 닫기(✕): 7일 숨김
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  getDeferredPrompt, clearDeferredPrompt, getMember,
  isInstalled, isLaterActive, isIOS, markInstalled, setLater,
} from './pwaInstall'

export default function PWAPrompt() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)
  const [openGuide, setOpenGuide] = useState(false)

  useEffect(() => {
    if (isInstalled() || isLaterActive()) return
    if (!getMember()) return // 비회원에게는 독립 노출 안 함
    setIos(isIOS())
    const t = setTimeout(() => setShow(true), 1500)
    return () => clearTimeout(t)
  }, [])

  if (pathname !== '/store/baegun/menu' && pathname !== '/store/baegun/table') return null
  if (!show) return null

  const dismiss = () => { setLater(7); setShow(false) }

  const onInstallClick = async () => {
    const dp = getDeferredPrompt()
    if (!ios && dp) {
      try {
        dp.prompt()
        const choice = await dp.userChoice
        if (choice?.outcome === 'accepted') markInstalled()
        clearDeferredPrompt()
        setShow(false)
        return
      } catch {}
    }
    setOpenGuide(g => !g) // 이벤트가 없거나 아이폰이면 안내 열기
  }

  return (
    <div style={{
      position: 'fixed', top: 64, right: 12, zIndex: 250, maxWidth: 300,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#1c1c1c', border: '1px solid #c8a900',
        borderRadius: 100, padding: '8px 12px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
      }}>
        <button onClick={onInstallClick} style={{
          background: 'none', border: 'none', color: '#FFD700',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0,
        }}>
          📲 또봉이 바로가기 설치
        </button>
        <button onClick={dismiss} aria-label="닫기" style={{
          background: 'none', border: 'none', color: '#666',
          fontSize: 14, lineHeight: 1, cursor: 'pointer', padding: 2,
        }}>
          ✕
        </button>
      </div>

      {openGuide && (
        <div style={{
          marginTop: 8, background: '#1c1c1c', border: '1px solid #444',
          borderRadius: 12, padding: '12px 14px', fontSize: 12,
          color: '#ccc', lineHeight: 1.8,
        }}>
          {ios
            ? <>아이폰은 Safari 하단 <span style={{ color: '#FFD700', fontWeight: 700 }}>공유 버튼(⬆️)</span>을 누른 뒤 <span style={{ color: '#FFD700', fontWeight: 700 }}>&lsquo;홈 화면에 추가&rsquo;</span>를 선택해 주세요.</>
            : <>브라우저 메뉴(⋮)에서 <span style={{ color: '#FFD700', fontWeight: 700 }}>&lsquo;홈 화면에 추가&rsquo;</span> 또는 <span style={{ color: '#FFD700', fontWeight: 700 }}>&lsquo;앱 설치&rsquo;</span>를 눌러주세요.</>}
        </div>
      )}
    </div>
  )
}
