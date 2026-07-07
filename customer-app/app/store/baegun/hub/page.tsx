'use client'
// Phase 5-2-b: 허브 화면 (오락실/음악감상실/자유게시판 3분할 진입)
import { useRouter } from 'next/navigation'
import BackToOrder from '../../../lib/BackToOrder'

const CARDS = [
  { key: 'arcade', emoji: '🎮', title: '오락실', desc: '추억의 게임 한 판', href: '/store/baegun/arcade' },
  { key: 'music', emoji: '🎵', title: '음악감상실', desc: '노래 듣고 한마디', href: '/store/baegun/music' },
  { key: 'board', emoji: '📝', title: '자유게시판', desc: '하고 싶은 이야기', href: '/store/baegun/board' },
]

export default function HubPage() {
  const router = useRouter()
  return (
    <main>
      <BackToOrder />
      <div style={{ padding: '24px 16px 48px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#f0f0f0', margin: '4px 0 4px' }}>기다리는 동안, 뭐 하실래요?</h2>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 22 }}>골라서 즐겨보세요 🍗</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {CARDS.map(c => (
            <button key={c.key} onClick={() => router.push(c.href)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 18px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 16, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 38 }}>{c.emoji}</span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#f0f0f0' }}>{c.title}</div>
                <div style={{ fontSize: 13, color: '#999', marginTop: 2 }}>{c.desc}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: '#666', fontSize: 22 }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
