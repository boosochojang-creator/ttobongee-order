'use client'
// [로그인정책 2026-08] 재방문 소셜 계정연결 유도 박스 (+음성안내).
//   대상: 기존 전화회원이면서 아직 소셜 미연결(서버 member/state의 banners.socialConnect=true).
//   재노출 규칙: "확인"은 이번 화면만 닫음 → 앱 재진입(재마운트)마다 다시 노출. 실제 연결해야만 서버에서 대상 제외되어 사라짐.
//   혜택: 연결 완료 시 콜라/사이다 500ml 택1 쿠폰 자동 지급(member/link에서 발급).
import { useEffect, useRef, useState } from 'react'
import { useStoreId } from './storeContext'
import { getMemberLocal } from './memberState'

// 방어적 음성 — 미지원/차단(사용자 제스처 전 등)에서 예외나도 조용히 무시. (기존 CouponContext.speakSafe 패턴)
function speakSafe(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ko-KR'; u.volume = 1; u.rate = 0.95
    window.speechSynthesis.speak(u)
  } catch {}
}

export default function SocialConnectPrompt() {
  const storeId = useStoreId()
  const [show, setShow] = useState(false)
  const spoke = useRef(false)

  useEffect(() => {
    const m = getMemberLocal()
    if (!m?.userId) return
    let alive = true
    fetch(`/api/member/state?userId=${m.userId}`)
      .then(r => r.json())
      .then(r => {
        if (!alive) return
        if (r?.ok && r.identity === 'known' && r.banners?.socialConnect) {
          setShow(true)
          if (!spoke.current) {
            spoke.current = true
            speakSafe('또봉이 보안 안내입니다. 이제 카카오, 구글, 네이버로 간편하고 안전하게 연결해 주세요. 지금 연결하시면 콜라 또는 사이다를 드려요.')
          }
        }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!show) return null

  const startConnect = (provider: 'kakao' | 'google' | 'naver') => {
    window.location.href = `/api/auth/${provider}/start?storeId=${storeId}&mode=connect`
  }

  const iconBtn = (provider: 'kakao' | 'google' | 'naver', bg: string, label: string, inner: React.ReactNode) => (
    <button onClick={() => startConnect(provider)} aria-label={`${label} 계정 연결`}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      <span style={{ width: 48, height: 48, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', border: provider === 'google' ? '1px solid #ddd' : 'none' }}>
        {inner}
      </span>
      <span style={{ fontSize: 11.5, color: '#e0d3a8' }}>{label}</span>
    </button>
  )

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(200,169,0,0.18), rgba(120,80,20,0.10))',
      border: '1px solid #7a6400', borderRadius: 14,
      padding: '18px 16px', margin: '12px 16px 0',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: '#FFD700' }}>🔐 안전한 로그인으로 바꿔주세요</div>
      <div style={{ fontSize: 13.5, color: '#e6e0cf', lineHeight: 1.75 }}>
        보안 정책이 강화되어, 이제 <b style={{ color: '#FFD700' }}>전화번호 대신 소셜 계정 연결</b>을 권장드려요.<br />
        연결하면 <b style={{ color: '#FFD700' }}>기존 단골 혜택·쿠폰은 그대로</b> 이어지고, 전화번호는 자동으로 삭제돼요.
      </div>
      <div style={{
        background: 'rgba(58,196,125,0.14)', border: '1px solid #3ac47d66', borderRadius: 10,
        padding: '9px 12px', fontSize: 13, color: '#a9f0c6', lineHeight: 1.5,
      }}>
        🥤 지금 연결하면 <b>콜라 / 사이다 500ml 중 택1</b>을 드려요!
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 26, marginTop: 4 }}>
        {iconBtn('kakao', '#FEE500', '카카오',
          <svg viewBox="0 0 40 40" width="26" height="26" aria-hidden="true"><path d="M20 8.5c-7 0-12.7 4.4-12.7 9.9 0 3.5 2.4 6.6 5.9 8.3-.2.8-1 3.4-1 3.7-.1.4.2.4.4.3.15-.1 3.8-2.6 4.6-3.1.9.12 1.8.2 2.8.2 7 0 12.7-4.4 12.7-9.9S27 8.5 20 8.5z" fill="#3C1E1E"/></svg>)}
        {iconBtn('google', '#fff', '구글', <span style={{ fontSize: 23, fontWeight: 800, color: '#4285F4' }}>G</span>)}
        {iconBtn('naver', '#03C75A', '네이버', <span style={{ fontSize: 21, fontWeight: 900, color: '#fff' }}>N</span>)}
      </div>
      <button
        onClick={() => setShow(false)}
        style={{
          marginTop: 2, padding: '9px', background: 'none', color: '#9a9078',
          fontSize: 13, border: '1px solid #4a4430', borderRadius: 10, cursor: 'pointer',
        }}
      >
        확인 (다음에 연결할게요)
      </button>
    </div>
  )
}
