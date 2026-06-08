'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '../../../lib/cartStore'

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

export default function TablePage() {
  const router = useRouter()
  const { setTableNo, setOrderType, clearItems, isMember, phone, grade, visitCount } = useCart()
  const [showPopup, setShowPopup] = useState(false)
  const audioStarted = useRef(false)

  useEffect(() => {
    const closed = sessionStorage.getItem('music-popup-closed')
    if (!closed) setShowPopup(true)
  }, [])

  function startMusic() {
    if (audioStarted.current) return
    audioStarted.current = true
    try {
      const ctx = new AudioContext()
      const playNote = (freq: number, start: number, dur: number, vol: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(vol, ctx.currentTime + start)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
        osc.start(ctx.currentTime + start)
        osc.stop(ctx.currentTime + start + dur + 0.1)
      }
      const melody = [523,659,784,659,523,392,440,523,659,784,880,784,659,523]
      melody.forEach((freq, i) => playNote(freq, i * 0.35, 0.3, 0.06))
    } catch {}
  }

  function closePopup() {
    sessionStorage.setItem('music-popup-closed', '1')
    setShowPopup(false)
    startMusic()
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

      {/* 배경음악 팝업 */}
      {showPopup && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.85)',
          zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center'
        }}>
          <div style={{
            background:'#1c1c1c', borderRadius:'20px 20px 0 0',
            padding:'28px 24px 40px', width:'100%', maxWidth:'480px',
            borderTop:'2px solid #c8a900'
          }}>
            <div style={{fontSize:22, fontWeight:900, color:'#c8a900', marginBottom:10}}>
              🍗 또봉이통닭에 오신 걸 환영해요!
            </div>
            <div style={{fontSize:15, color:'#ccc', lineHeight:1.8, marginBottom:20}}>
              주문 전 <span style={{color:'#FFD700', fontWeight:700}}>3초 로그인</span>으로{' '}
              <span style={{color:'#FF6B00', fontWeight:700}}>5% 할인</span> 혜택을 받으세요!<br/>
              매장 QR 또는 NFC로 언제든 빠른 주문이 가능합니다.<br/>
              <span style={{color:'#FFD700', fontWeight:700}}>오늘도 최고의 바삭함</span>으로 보답하겠습니다 😊
            </div>
            <button
              onClick={closePopup}
              style={{
                width:'100%', padding:'16px',
                background:'#c8a900', color:'#111',
                fontSize:16, fontWeight:700,
                borderRadius:12, border:'none', cursor:'pointer'
              }}
            >
              확인하고 주문하러 가기 🎵
            </button>
            <button
              onClick={closePopup}
              style={{
                width:'100%', marginTop:10, padding:'12px',
                background:'none', color:'#666',
                fontSize:13, border:'none', cursor:'pointer'
              }}
            >
              오늘 하루 닫기
            </button>
          </div>
        </div>
      )}

      <div className="table-map">
        {/* 회원/비회원 인사말 */}
        {isMember ? (
          <>
            <h2 style={{fontSize:28, fontWeight:900, marginBottom:8}}>
              {phone.slice(-4)}님 어서오세요! 👋
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
              <span style={{color:'#FF6B00', fontWeight:700}}>5% 추가 할인</span>{' '}
              혜택도 놓치지 마세요!<br/>
              오늘도{' '}
              <span style={{color:'#FFD700', fontWeight:700}}>최고의 바삭함</span>으로 보답하겠습니다.
            </>
          )}
        </div>
      </div>
    </main>
  )
}
