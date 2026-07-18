'use client'
// Phase 5-2-b: 허브/하위 화면 상단 고정 '주문하러 가기' 바 (어디서든 즉시 주문화면 복귀)
import { useRouter } from 'next/navigation'
import { useStoreId } from './storeContext'

export default function BackToOrder({ title }: { title?: string }) {
  const router = useRouter()
  const storeId = useStoreId()
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px', background: '#111', borderBottom: '1px solid #2a2a2a',
    }}>
      <button onClick={() => router.push(`/store/${storeId}/menu`)}
        style={{ background: '#1c1c1c', border: '1px solid #c8a900', color: '#FFD700', borderRadius: 20, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        ← 주문하러 가기
      </button>
      {title && <span style={{ fontWeight: 800, color: '#f0f0f0', fontSize: 15 }}>{title}</span>}
    </div>
  )
}
