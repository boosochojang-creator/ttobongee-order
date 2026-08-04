'use client'
// [PWA 자동 반영 — 점주앱] 새 배포 감지 시 '탭하면 업데이트' 안내 배너만 노출.
//   ★영업 중 주문 처리/입력(메뉴수정·거절사유·일괄발송 등) 도중 갑자기 새로고침되면 안 되므로,
//    점주앱은 자동 새로고침을 하지 않고 점주가 '안전한 시점(주문 사이)'에 직접 탭해서 반영한다.
import { useEffect, useRef, useState } from 'react'

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'

export default function VersionWatcher() {
  const [hasNew, setHasNew] = useState(false)
  const dismissed = useRef(false)

  useEffect(() => {
    if (CURRENT === 'dev') return
    let alive = true
    const check = async () => {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' }).then(x => x.json())
        if (alive && r?.id && r.id !== 'dev' && r.id !== CURRENT) setHasNew(true)
      } catch {}
    }
    check()
    const iv = setInterval(check, 4 * 60 * 1000)
    const onVis = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; clearInterval(iv); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  if (!hasNew || dismissed.current) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
      background: 'linear-gradient(90deg, #1e6f3a, #2ea158)', color: '#fff',
      padding: '9px 12px', fontSize: 13, fontWeight: 700, boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
    }}>
      🔄 새 버전이 있어요 — 주문 처리 사이 여유 있을 때 눌러 업데이트하세요
      <button onClick={() => window.location.reload()}
        style={{ background: '#fff', color: '#1e6f3a', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
        지금 업데이트
      </button>
      <button onClick={() => { dismissed.current = true; setHasNew(false) }}
        style={{ background: 'transparent', color: '#dff5e6', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>
        나중에
      </button>
    </div>
  )
}
