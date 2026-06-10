'use client'
import { useBgm } from './BgmContext'

export default function GlobalBgmButton() {
  const { muted, toggleMuted } = useBgm()

  return (
    <button
      onClick={toggleMuted}
      style={{
        position: 'fixed', bottom: 178, right: 16, zIndex: 200,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 14px',
        background: '#1c1c1c', border: '1.5px solid #444',
        borderRadius: 24, cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{muted ? '🔇' : '🎵'}</span>
      <span style={{ fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>
        {muted ? '음악 켜기' : '음악 끄기'}
      </span>
    </button>
  )
}
