'use client'
// Phase 5-2-c-1: 오락실 — 활성 게임 목록에서 골라 iframe으로 플레이 (독립형 HTML/Canvas, 외부 에셋 없음)
import { useEffect, useState } from 'react'
import BackToOrder from '../../../lib/BackToOrder'

const backBtn: React.CSSProperties = {
  background: '#1c1c1c', border: '1px solid #c8a900', color: '#FFD700',
  borderRadius: 20, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
}

export default function ArcadePage() {
  const [games, setGames] = useState<any[]>([])
  const [playing, setPlaying] = useState<any | null>(null)

  useEffect(() => {
    fetch('/api/arcade/list').then(x => x.json()).then(r => setGames(r?.ok ? r.games : [])).catch(() => {})
  }, [])

  if (playing) {
    return (
      <main>
        <div style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#111', borderBottom: '1px solid #2a2a2a' }}>
          <button onClick={() => setPlaying(null)} style={backBtn}>← 게임 목록</button>
          <span style={{ fontWeight: 800, color: '#f0f0f0', fontSize: 15 }}>{playing.name}</span>
        </div>
        <iframe src={`/games/${playing.file_key}.html`} title={playing.name}
          style={{ width: '100%', height: 'calc(100vh - 54px)', border: 'none', display: 'block', background: '#000' }} />
      </main>
    )
  }

  return (
    <main>
      <BackToOrder title="🎮 오락실" />
      <div style={{ padding: '20px 16px 40px' }}>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>게임을 골라 한 판 즐겨보세요! (터치·키보드 지원)</p>
        {games.length === 0 && <div style={{ color: '#888', textAlign: 'center', padding: 30 }}>준비된 게임이 없어요</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {games.map(g => (
            <button key={g.id} onClick={() => setPlaying(g)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 30 }}>🕹️</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#f0f0f0' }}>{g.name}</span>
              <span style={{ marginLeft: 'auto', color: '#666' }}>▶</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 24, fontSize: 12, color: '#555', textAlign: 'center' }}>💬 한마디 남기기는 곧 열려요</div>
      </div>
    </main>
  )
}
