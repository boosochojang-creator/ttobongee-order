'use client'
// Phase 5-2-b → UX A1: 앱 재설치 안내를 허브 화면 인라인 카드로 이동
// (메뉴 플로팅에서 제거 — 담기 버튼 가림/신규 손님 뜬금없음 해소. "이미 설치했다 지운 사람"은
//  브라우저에서 판별 불가하므로, 손님이 스스로 들어온 허브에 맥락 있는 안내로 배치)
import { useState } from 'react'
import { getDeferredPrompt, clearDeferredPrompt, isIOS, markInstalled } from './pwaInstall'

export default function PWAReinstallButton() {
  const [guide, setGuide] = useState(false)

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
          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          padding: '16px 18px', background: '#141414', border: '1px dashed #555',
          borderRadius: 14, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 26, lineHeight: 1 }}>📲</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e6e6e6' }}>또봉이 홈 화면에 추가하기</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>다음엔 QR 없이 바로 들어와요 · 실수로 지웠다면 여기서 다시 설치</div>
        </div>
      </button>

      {guide && (
        <div onClick={() => setGuide(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 340, background: '#1c1c1c', border: '1px solid #c8a900', borderRadius: 16, padding: '22px 18px' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#f0f0f0', marginBottom: 12 }}>📲 홈 화면에 추가하기</div>
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
