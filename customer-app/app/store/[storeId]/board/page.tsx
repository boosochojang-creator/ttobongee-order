'use client'
// Phase 5-2-e-1: 자유게시판 — 공개글/비밀글(사진첨부)/댓글 (통합 HanmadiSection board 모드)
import BackToOrder from '../../../lib/BackToOrder'
import HanmadiSection from '../../../lib/HanmadiSection'

export default function BoardPage() {
  return (
    <main>
      <BackToOrder title="📝 자유게시판" />
      <div style={{ padding: '20px 16px 44px' }}>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>하고 싶은 이야기를 자유롭게 남겨보세요. 비밀글은 점주님만 볼 수 있어요 🔒</p>
        <HanmadiSection source="board" title="✍️ 글쓰기" board />
      </div>
    </main>
  )
}
