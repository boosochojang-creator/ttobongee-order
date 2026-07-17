'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '../../../lib/cartStore'
import { greetingLabel } from '../../../lib/memberState'
import LegalFooter from '../../../lib/LegalFooter'

const TABLES = [
  { no: 1, label: '1번', sub: '테이블' },
  { no: 2, label: '2번', sub: '테이블' },
  { no: 3, label: '3번', sub: '테이블' },
  { no: 4, label: '4번', sub: '테이블' },
  { no: 5, label: '5번', sub: '테이블' },
  { no: 6, label: '6번', sub: '테이블' },
  { no: 7, label: '7번', sub: '테이블' },
  { no: 8, label: '외부1', sub: '외부석' },
  { no: 9, label: '외부2', sub: '외부석' },
]

const GRADE_LABEL: Record<string, string> = { gold: '🥇 골드 단골', silver: '🥈 실버 단골', bronze: '🥉 브론즈 단골' }
const GRADE_COLOR: Record<string, string> = { gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32' }

function stripEmoji(text: string) {
  // eslint-disable-next-line
  return text.replace(new RegExp('[\\p{Emoji_Presentation}\\p{Extended_Pictographic}]', 'gu'), '').trim()
}

export default function TablePage() {
  const router = useRouter()
  const { setTableNo, setOrderType, clearItems, isMember, phone, nickname, grade, visitCount } = useCart()
  const [greetingText, setGreetingText] = useState<string | null>(null)
  const memberRef = useRef({ isMember, phone, nickname })
  memberRef.current = { isMember, phone, nickname }

  // C5: 전체화면 웰컴 팝업이 자리선택을 덮던 문제 → 자리 즉시 노출. 환영 인사는 비차단 토스트로(세션 1회, 하이드레이션 후).
  useEffect(() => {
    if (sessionStorage.getItem('welcomed-session')) return
    sessionStorage.setItem('welcomed-session', '1')
    const t = setTimeout(() => {
      const mem = memberRef.current
      showGreetingToast(mem.isMember && mem.phone
        ? `${greetingLabel(mem.nickname, mem.phone)}님, 다시 오셨군요! 반갑습니다`
        : '또봉이통닭 백운역점에 오신 것을 환영합니다')
    }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function speakGreeting(text: string) {
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'ko-KR'; u.volume = 1; u.rate = 0.92
      window.speechSynthesis.speak(u)
    } catch {}
  }

  function showGreetingToast(text: string) {
    setGreetingText(text)
    speakGreeting(text)
    setTimeout(() => setGreetingText(null), 3000)
  }

  function beep() {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      osc.start(); osc.stop(ctx.currentTime + 0.1)
    } catch {}
  }

  function select(t: { no: number }) {
    beep()
    clearItems()
    setTableNo(String(t.no))
    setOrderType('dine_in')
    router.push('/store/baegun/menu')
  }

  function takeout() {
    beep()
    clearItems()
    setTableNo('0')
    setOrderType('takeout')
    router.push('/store/baegun/menu')
  }

  return (
    <main>
      <div className="top-bar">
        <span className="logo">🍗 또봉이통닭 백운역점</span>
      </div>

      {/* 인사말 토스트 */}
      {greetingText && (
        <div style={{
          position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(30,30,30,0.96)', border: '1px solid #c8a900',
          borderRadius: 14, padding: '14px 22px',
          fontSize: 16, fontWeight: 700, color: '#f0f0f0',
          zIndex: 500, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.3s ease',
        }}>
          {greetingText}
        </div>
      )}

      <div className="table-map">
        {/* 회원/비회원 인사말 */}
        {isMember ? (
          <>
            <h2 style={{fontSize:28, fontWeight:900, marginBottom:8}}>
              {greetingLabel(nickname, phone)}님 어서오세요! 👋
            </h2>
            <div style={{display:'flex', gap:8, justifyContent:'center', alignItems:'center', marginBottom:8}}>
              <span style={{
                background: `${GRADE_COLOR[grade] ?? '#CD7F32'}22`,
                color: GRADE_COLOR[grade] ?? '#CD7F32',
                border: `1px solid ${GRADE_COLOR[grade] ?? '#CD7F32'}66`,
                borderRadius:20, padding:'3px 12px', fontSize:13, fontWeight:700,
              }}>
                {GRADE_LABEL[grade] ?? '🥉 브론즈 단골'}
              </span>
              <span style={{fontSize:13, color:'#888'}}>· {visitCount}번째 방문</span>
            </div>
          </>
        ) : (
          <h2 style={{fontSize:28, fontWeight:900}}>어느 자리에 계세요?</h2>
        )}

        <p style={{fontSize:16, color:'#aaa', marginBottom:24, lineHeight:1.7}}>
          테이블 또는 좌석 바닥에 부착된 번호를 확인 후<br/>해당 번호를 눌러주세요
        </p>

        <div className="table-grid">
          {TABLES.map(t => (
            <button key={t.no} className="table-btn" onClick={() => select(t)}>
              <span className="tnum">{t.label}</span>
              <span>{t.sub}</span>
            </button>
          ))}
        </div>

        <button className="takeout-btn" onClick={takeout}>
          🛍️ 포장 주문
        </button>

        <div style={{
          marginTop:28, padding:'20px 16px',
          textAlign:'center', fontSize:14,
          lineHeight:1.9, color:'#CCCCCC'
        }}>
          {isMember ? (
            <>오늘도 <span style={{color:'#FFD700', fontWeight:700}}>최고의 바삭함</span>으로 보답하겠습니다 😊</>
          ) : (
            <>🎁 주문 전{' '}
              <span style={{color:'#FFD700', fontWeight:700}}>3초 로그인</span>으로{' '}
              <span style={{color:'#FF6B00', fontWeight:700}}>튀김만두 5개 무료 증정</span>{' '}
              받으세요!<br/>
              오늘도{' '}
              <span style={{color:'#FFD700', fontWeight:700}}>최고의 바삭함</span>으로 보답하겠습니다.
            </>
          )}
        </div>
      </div>
      <LegalFooter />
    </main>
  )
}
