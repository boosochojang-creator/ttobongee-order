'use client'
// UX A1(B안): 우측에 흩어져 +담기 버튼을 가리던 플로팅 버튼(직원호출·허브)을
// 단일 speed-dial FAB로 통합. 평소엔 버튼 하나, 누르면 위로 펼쳐짐(스크림으로 뒤 요소 보호).
// 직원호출은 점주 broadcast까지 포함(기존 메뉴 자체 버튼은 broadcast 누락 버그가 있었음).
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from './cartStore'
import { supabase } from './supabase'

const CALL_ITEMS = ['💧 물 주세요', '🥗 치킨무 추가', '🧻 물티슈 주세요', '👋 직원 직접 호출']

function stripEmoji(text: string) {
  // eslint-disable-next-line
  return text.replace(new RegExp('[\\p{Emoji_Presentation}\\p{Extended_Pictographic}]', 'gu'), '').trim()
}

export default function GlobalActionFab() {
  const pathname = usePathname()
  const router = useRouter()
  const { tableNo } = useCart()
  const [open, setOpen] = useState(false)
  const [showSheet, setShowSheet] = useState(false)

  // 자리선택 화면에서는 숨김(주문 대기 화면에서만 노출)
  if (pathname === '/store/baegun/table') return null
  // 허브 진입은 메뉴/자리 화면에서만 의미 있음
  const showHub = pathname === '/store/baegun/menu'

  const handleSelect = (item: string) => {
    // 비프음 (880hz → 1100hz)
    try {
      const ctx = new AudioContext()
      ;[880, 1100].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.connect(g); g.connect(ctx.destination)
        osc.frequency.value = freq
        g.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.2)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.15)
        osc.start(ctx.currentTime + i * 0.2)
        osc.stop(ctx.currentTime + i * 0.2 + 0.2)
      })
    } catch {}
    // 음성
    try {
      const label = tableNo && tableNo !== '0' ? `${tableNo}번 테이블` : '포장'
      const u = new SpeechSynthesisUtterance(`${label} ${stripEmoji(item)} 호출입니다`)
      u.lang = 'ko-KR'; u.volume = 1; u.rate = 0.9
      window.speechSynthesis.speak(u)
    } catch {}
    // 점주 broadcast 송신
    try {
      const ch = supabase.channel('customer-calls')
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.send({ type: 'broadcast', event: 'call', payload: { tableNo, message: item } })
          setTimeout(() => supabase.removeChannel(ch), 1000)
        }
      })
    } catch {}
    setShowSheet(false)
    setOpen(false)
  }

  const pill = (onClick: () => void, emoji: string, label: string, gold?: boolean) => (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
        background: '#1c1c1c', border: `1.5px solid ${gold ? '#c8a900' : '#555'}`,
        borderRadius: 24, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{emoji}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: gold ? '#FFD700' : '#ddd' }}>{label}</span>
    </button>
  )

  return (
    <>
      {/* 펼침 상태 스크림 — 뒤 요소(메뉴 +버튼 등) 오터치 차단 */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.35)' }} />
      )}

      <div style={{
        position: 'fixed', bottom: 90, right: 16, zIndex: 201,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10,
      }}>
        {open && (
          <>
            {showHub && pill(() => { setOpen(false); router.push('/store/baegun/hub') }, '🎮', '잠깐 쉬었다 갈까요?', true)}
            {pill(() => { setOpen(false); setShowSheet(true) }, '🔔', '직원호출')}
          </>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? '닫기' : '도움 · 놀거리'}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: open ? '#333' : '#1c1c1c', border: '1.5px solid #c8a900',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            transition: 'transform 0.15s',
            transform: open ? 'rotate(90deg)' : 'none',
          }}
        >
          {open ? '✕' : '🔔'}
        </button>
      </div>

      {/* 직원 호출 시트 */}
      {showSheet && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowSheet(false)}
        >
          <div
            style={{ background: '#1c1c1c', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 480 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: '#fff' }}>무엇이 필요하세요?</div>
            {CALL_ITEMS.map(t => (
              <button
                key={t}
                onClick={() => handleSelect(t)}
                style={{ display: 'block', width: '100%', padding: '14px', background: '#2a2a2a', border: '1px solid #333', borderRadius: 12, marginBottom: 8, fontSize: 15, color: '#fff', textAlign: 'left', cursor: 'pointer' }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
