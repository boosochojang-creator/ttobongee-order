'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useCart } from './cartStore'
import { supabase } from './supabase'

const CALL_ITEMS = ['💧 물 주세요', '🥗 치킨무 추가', '🧻 물티슈 주세요', '👋 직원 직접 호출']

function stripEmoji(text: string) {
  // eslint-disable-next-line
  return text.replace(new RegExp('[\\p{Emoji_Presentation}\\p{Extended_Pictographic}]', 'gu'), '').trim()
}

export default function GlobalCallButton() {
  const pathname = usePathname()
  const { tableNo } = useCart()
  const [showSheet, setShowSheet] = useState(false)

  if (pathname === '/store/baegun/table') return null

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

    // Supabase broadcast 송신
    try {
      const ch = supabase.channel('customer-calls')
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.send({
            type: 'broadcast',
            event: 'call',
            payload: { tableNo, message: item },
          })
          setTimeout(() => supabase.removeChannel(ch), 1000)
        }
      })
    } catch {}

    setShowSheet(false)
  }

  return (
    <>
      <button
        onClick={() => setShowSheet(true)}
        style={{
          position: 'fixed', bottom: 90, right: 16, zIndex: 200,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 4, width: 60, height: 76,
          background: '#1c1c1c', border: '1.5px solid #444',
          borderRadius: 16, cursor: 'pointer', fontSize: 26,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        🔔
        <span style={{ fontSize: 10, color: '#aaa', lineHeight: 1 }}>직원호출</span>
      </button>

      {showSheet && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={() => setShowSheet(false)}
        >
          <div
            style={{
              background: '#1c1c1c', borderRadius: '20px 20px 0 0',
              padding: '24px 20px 40px', width: '100%', maxWidth: 480,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: '#fff' }}>
              무엇이 필요하세요?
            </div>
            {CALL_ITEMS.map(t => (
              <button
                key={t}
                onClick={() => handleSelect(t)}
                style={{
                  display: 'block', width: '100%', padding: '14px',
                  background: '#2a2a2a', border: '1px solid #333',
                  borderRadius: 12, marginBottom: 8,
                  fontSize: 15, color: '#fff', textAlign: 'left', cursor: 'pointer',
                }}
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
