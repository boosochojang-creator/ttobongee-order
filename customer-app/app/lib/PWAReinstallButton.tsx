'use client'
// Phase 5-2-b: 앱 재설치 버튼 (상시 노출). 안드로이드=네이티브 설치 프롬프트, iOS=공유→홈화면 안내 모달.
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { getDeferredPrompt, clearDeferredPrompt, isIOS, markInstalled } from './pwaInstall'

export default function PWAReinstallButton() {
  const pathname = usePathname()
  const [guide, setGuide] = useState(false)
  // 주문 대기 주요 화면에 상시 노출 (몰입형 결제/게임 화면 제외)
  if (pathname !== '/store/baegun/menu' && pathname !== '/store/baegun/table') return null

  const ios = isIOS()
  const onClick = async () => {
    const dp = getDeferredPrompt()
    if (!ios && dp) {
      try {
        dp.prompt()
        const choice = await dp.userChoice
        if (choice?.outcome === 'accepted') markInstalled()
        clearDeferredPrompt()
        return
      } catch {}
    }
    setGuide(true) // iOS 또는 프롬프트 없음 → 수동 안내
  }

  return (
    <>
      <button
        onClick={onClick}
        style={{
          position: 'fixed', bottom: 238, right: 16, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px',
          background: '#1c1c1c', border: '1.5px solid #444', borderRadius: 24,
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>📲</span>
        <span style={{ fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>앱 다시 설치</span>
      </button>

      {guide && (
        <div onClick={() => setGuide(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 340, background: '#1c1c1c', border: '1px solid #c8a900', borderRadius: 16, padding: '22px 18px' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#f0f0f0', marginBottom: 12 }}>📲 앱 다시 설치하기</div>
            {ios ? (
              <div style={{ fontSize: 14, color: '#ddd', lineHeight: 1.9 }}>
                아이폰(Safari)에서는:<br />
                1. 화면 하단 <span style={{ color: '#FFD700', fontWeight: 700 }}>공유 버튼(⬆️)</span> 누르기<br />
                2. 목록에서 <span style={{ color: '#FFD700', fontWeight: 700 }}>‘홈 화면에 추가’</span> 선택<br />
                3. 오른쪽 위 <span style={{ color: '#FFD700', fontWeight: 700 }}>‘추가’</span> 누르기
              </div>
            ) : (
              <div style={{ fontSize: 14, color: '#ddd', lineHeight: 1.9 }}>
                브라우저 메뉴 <span style={{ color: '#FFD700', fontWeight: 700 }}>(⋮)</span>를 열고<br />
                <span style={{ color: '#FFD700', fontWeight: 700 }}>‘홈 화면에 추가’</span> 또는 <span style={{ color: '#FFD700', fontWeight: 700 }}>‘앱 설치’</span>를 눌러주세요.
              </div>
            )}
            <button onClick={() => setGuide(false)}
              style={{ width: '100%', marginTop: 16, padding: 12, background: '#c8a900', color: '#111', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>확인</button>
          </div>
        </div>
      )}
    </>
  )
}
