'use client'
// Phase 5-2-d에서 음악감상실 구현 예정 (현재는 진입/복귀 구조만)
import BackToOrder from '../../../lib/BackToOrder'

export default function MusicPage() {
  return (
    <main>
      <BackToOrder title="🎵 음악감상실" />
      <div style={{ padding: 48, textAlign: 'center', color: '#888', fontSize: 14, lineHeight: 1.8 }}>
        곧 열려요! 조금만 기다려주세요 🍗
      </div>
    </main>
  )
}
