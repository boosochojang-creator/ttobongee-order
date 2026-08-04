'use client'
// [PWA 자동 반영] 새 배포를 감지해 '안전한 시점'에만 최신 코드로 새로고침.
//   - 감지: 실행 중 코드의 빌드ID(NEXT_PUBLIC_BUILD_ID) vs 서버 /api/version(런타임 SHA).
//   - 안전 판단: 장바구니가 비어있고, 주문/결제/로그인 흐름 화면이 아닐 때만 자동 새로고침.
//     그 외(담는 중·결제·로그인 등)에는 입력이 날아가지 않도록 자동 새로고침을 미루고,
//     상단에 '탭하면 업데이트' 안내 배너만 띄운다. 안전해지면(장바구니 비움·다른 화면 이동) 자동 적용.
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useCart } from './cartStore'

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'
// 새로고침 금지 화면(입력·결제 흐름). 이 경로에선 자동 새로고침 안 함.
const BLOCK = ['/checkout', '/cart', '/login', '/order-status', '/auth']

export default function VersionWatcher() {
  const pathname = usePathname()
  const { totalQty } = useCart()
  const [hasNew, setHasNew] = useState(false)
  const reloaded = useRef(false)

  // 새 배포 감지 — 주기 폴링 + 앱 포그라운드 복귀 시(설치 PWA 재개 대응)
  useEffect(() => {
    if (CURRENT === 'dev') return // 로컬/미설정은 비활성
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

  const safe = totalQty === 0 && !BLOCK.some(p => pathname?.includes(p))

  // 안전하면 자동 새로고침(살짝 지연). 안전하지 않으면 배너만.
  useEffect(() => {
    if (hasNew && safe && !reloaded.current) {
      reloaded.current = true
      const t = setTimeout(() => window.location.reload(), 400)
      return () => clearTimeout(t)
    }
  }, [hasNew, safe])

  if (!hasNew || safe) return null // 안전하면 조용히 자동 적용(배너 불필요)

  return (
    <button
      onClick={() => window.location.reload()}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 600,
        background: 'linear-gradient(90deg, #c8a900, #e0c040)', color: '#111',
        border: 'none', padding: '10px 14px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)', textAlign: 'center',
      }}>
      🔄 새 버전이 준비됐어요 — 지금 주문을 마치면 자동 반영돼요. 탭하면 바로 업데이트
    </button>
  )
}
