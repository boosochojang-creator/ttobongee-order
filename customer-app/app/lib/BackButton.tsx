'use client'
import { useRouter } from 'next/navigation'

export default function BackButton({ title }: { title: string }) {
  const router = useRouter()
  return (
    <div style={{ position: 'sticky', top: 0, background: '#111', borderBottom: '1px solid #222', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 }}>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#e0e0e0', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
      <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
    </div>
  )
}
