'use client'
// Phase 5-2-b: 기존 배경음악 버튼 자리를 '허브 진입' 버튼으로 교체 (위치·스타일 유지, 기능만 변경)
import { usePathname, useRouter } from 'next/navigation'

// 최종 문구 조정용 상수 (루나 감성)
export const HUB_ENTRY_LABEL = '🎮 잠깐 쉬었다 갈까요?'

export default function GlobalHubButton() {
  const router = useRouter()
  const pathname = usePathname()
  // 대기 중 주요 화면에서만 노출 (허브/하위화면·결제 등에서는 숨김)
  if (pathname !== '/store/baegun/menu' && pathname !== '/store/baegun/table') return null
  return (
    <button
      onClick={() => router.push('/store/baegun/hub')}
      style={{
        position: 'fixed', bottom: 178, right: 16, zIndex: 200,
        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px',
        background: '#1c1c1c', border: '1.5px solid #c8a900', borderRadius: 24,
        cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    >
      <span style={{ fontSize: 12, color: '#FFD700', fontWeight: 700, whiteSpace: 'nowrap' }}>{HUB_ENTRY_LABEL}</span>
    </button>
  )
}
