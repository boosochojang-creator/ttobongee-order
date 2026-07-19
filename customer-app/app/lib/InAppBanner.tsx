'use client'
// [1단계] 인앱 브라우저(카카오톡·네이버 등) 우회 안내 배너.
// 인앱 웹뷰에서는 홈화면 설치·웹푸시·알림이 제한되므로 외부 브라우저(크롬/사파리)로 열도록 안내.
// 안드로이드: '외부 브라우저로 열기' 버튼으로 자동 전환. iOS: 메뉴에서 직접 열도록 안내 + 링크 복사.
import { useEffect, useState } from 'react'
import { isInAppBrowser, canAutoEscape, isAndroid, openInExternalBrowser } from './inApp'

export default function InAppBanner() {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isInAppBrowser()) setShow(true)
  }, [])

  if (!show) return null

  const android = isAndroid()

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 클립보드 실패 시 임시 입력창 선택 방식 폴백
      try {
        const el = document.createElement('input')
        el.value = window.location.href
        document.body.appendChild(el); el.select()
        document.execCommand('copy'); document.body.removeChild(el)
        setCopied(true); setTimeout(() => setCopied(false), 2000)
      } catch {}
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22,
    }}>
      <div style={{
        width: '100%', maxWidth: 380, background: '#1c1c1c', border: '1px solid #c8a900',
        borderRadius: 18, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#FFD700' }}>🍗 외부 브라우저로 열어주세요</div>
        <div style={{ fontSize: 14, color: '#ddd', lineHeight: 1.75 }}>
          지금은 <b style={{ color: '#fff' }}>카카오톡·네이버 앱 안의 브라우저</b>예요.<br />
          여기서는 <b style={{ color: '#FFD700' }}>앱 설치·알림 받기</b>가 제한돼요.
          크롬·사파리에서 열면 <b style={{ color: '#FFD700' }}>쿠폰 알림</b>까지 편하게 받을 수 있어요 😊
        </div>

        {android ? (
          <>
            <button onClick={() => openInExternalBrowser()} style={{
              padding: '14px', background: '#c8a900', color: '#111', fontWeight: 800, fontSize: 16,
              border: 'none', borderRadius: 12, cursor: 'pointer',
            }}>🌐 외부 브라우저로 열기</button>
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.7, textAlign: 'center' }}>
              버튼이 안 되면 우측 위 <b style={{ color: '#bbb' }}>⋮ 메뉴 → &lsquo;다른 브라우저로 열기&rsquo;</b>를 눌러주세요.
            </div>
          </>
        ) : (
          <>
            <div style={{ background: '#141414', border: '1px solid #333', borderRadius: 12, padding: '14px 16px', fontSize: 13.5, color: '#ccc', lineHeight: 1.9 }}>
              <div style={{ fontWeight: 800, color: '#f0f0f0', marginBottom: 6 }}>📱 이렇게 열어주세요</div>
              1. 화면 <b style={{ color: '#FFD700' }}>우측 아래(또는 위) ··· 메뉴</b> 누르기<br />
              2. <b style={{ color: '#FFD700' }}>&lsquo;Safari로 열기&rsquo;</b> 또는 <b style={{ color: '#FFD700' }}>&lsquo;다른 브라우저로 열기&rsquo;</b> 선택
            </div>
            <button onClick={copyLink} style={{
              padding: '13px', background: copied ? '#2a4a2a' : '#2a2a2a', color: copied ? '#8ee08e' : '#f0f0f0',
              fontWeight: 700, fontSize: 14, border: '1px solid #444', borderRadius: 12, cursor: 'pointer',
            }}>{copied ? '✅ 링크 복사됨 — 사파리 주소창에 붙여넣기' : '🔗 링크 복사하기'}</button>
          </>
        )}

        <button onClick={() => setShow(false)} style={{
          background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer', padding: 4,
        }}>그냥 여기서 볼게요</button>
      </div>
    </div>
  )
}
