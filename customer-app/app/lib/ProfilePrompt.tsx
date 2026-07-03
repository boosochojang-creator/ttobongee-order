'use client'
// 추가정보 입력 유도 카드 (그룹 B-2)
// phone_member / profile_incomplete 회원에게만, 당일 닫기·3회 초과 시 자동 노출 중단.
// profile_complete 회원에게는 아무것도 안 띄움.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getMemberLocal, shouldShowProfilePrompt, dismissProfilePromptToday,
} from './memberState'

export default function ProfilePrompt() {
  const router = useRouter()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!shouldShowProfilePrompt()) return
    setShow(true)
    // 노출 기록 (실패해도 무시 — 화면 동작에 영향 없음)
    const m = getMemberLocal()
    if (m) {
      fetch('/api/member-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prompt_shown', userId: m.userId }),
      }).catch(() => {})
    }
  }, [])

  if (!show) return null

  const later = () => {
    const count = dismissProfilePromptToday()
    setShow(false)
    const m = getMemberLocal()
    if (m) {
      fetch('/api/member-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prompt_dismiss', userId: m.userId, count }),
      }).catch(() => {})
    }
  }

  return (
    <div style={{
      background: 'rgba(200,169,0,0.08)', border: '1px solid #7a640066',
      borderRadius: 12, padding: '14px 16px', margin: '12px 16px 0',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', lineHeight: 1.6 }}>
        🎂 생일·주소 추가하면 <span style={{ color: '#FFD700' }}>생일쿠폰</span>과{' '}
        <span style={{ color: '#FFD700' }}>배달 주문</span>을 더 편하게!
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => router.push('/store/baegun/profile')}
          style={{
            flex: 1, padding: '10px', background: '#c8a900', color: '#111',
            fontWeight: 700, fontSize: 14, borderRadius: 10, border: 'none', cursor: 'pointer',
          }}
        >
          30초 만에 추가하기
        </button>
        <button
          onClick={later}
          style={{
            padding: '10px 14px', background: 'none', color: '#888',
            fontSize: 13, border: '1px solid #333', borderRadius: 10, cursor: 'pointer',
          }}
        >
          오늘은 안 하기
        </button>
      </div>
    </div>
  )
}
