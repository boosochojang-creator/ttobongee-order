'use client'
// [고객상태 ⑤] 입구 QR(/?qr=1) 진입 첫 화면 — 매장 / 포장 선택.
//   매장 → 테이블 안내 화면(/table). 포장 → 포장(픽업) 모드로 메뉴(픽업시간은 체크아웃에서 예약).
//   기존 테이블 화면 안에 있던 '포장' 버튼은 제거하고 이 화면으로 이동.
//   재방문(known)이면 인사말 노출(단일 상태 소스 useMemberState).
import { useRouter } from 'next/navigation'
import { useCart } from '../../../lib/cartStore'
import { useStoreId } from '../../../lib/storeContext'
import { useMemberState } from '../../../lib/MemberStateContext'
import LegalFooter from '../../../lib/LegalFooter'

export default function EntryPage() {
  const router = useRouter()
  const storeId = useStoreId()
  const { setTableNo, setOrderType, clearItems } = useCart()
  const { identity, greeting } = useMemberState()

  const goDineIn = () => {
    clearItems()
    setOrderType('dine_in')
    router.push(`/store/${storeId}/table`)
  }
  const goTakeout = () => {
    clearItems()
    setTableNo('0')
    setOrderType('takeout')
    router.push(`/store/${storeId}/menu`)
  }

  return (
    <main>
      <div className="top-bar">
        <span className="logo">🍗 또봉이통닭 백운역점</span>
      </div>

      <div style={{ padding: '32px 20px 40px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>
          {identity === 'known' && greeting ? `${greeting} 👋` : '어서오세요! 👋'}
        </h2>
        <p style={{ fontSize: 16, color: '#aaa', marginBottom: 28, lineHeight: 1.7 }}>
          매장에서 드시나요, 포장하시나요?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420, margin: '0 auto' }}>
          <button onClick={goDineIn} style={{
            padding: '26px 18px', borderRadius: 18, border: '2px solid #c8a900',
            background: 'linear-gradient(135deg, rgba(200,169,0,0.18), rgba(200,169,0,0.06))',
            color: '#f0f0f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <span style={{ fontSize: 40 }}>🍗</span>
            <span style={{ textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 900, color: '#FFD700' }}>매장에서 먹을게요</span>
              <span style={{ display: 'block', fontSize: 13, color: '#bbb', marginTop: 4 }}>자리 번호를 고르고 주문해요</span>
            </span>
          </button>

          <button onClick={goTakeout} style={{
            padding: '26px 18px', borderRadius: 18, border: '2px solid #7a6400',
            background: '#1a1200', color: '#f0f0f0', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <span style={{ fontSize: 40 }}>🛍️</span>
            <span style={{ textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 900, color: '#f0d890' }}>포장할게요</span>
              <span style={{ display: 'block', fontSize: 13, color: '#bbb', marginTop: 4 }}>픽업 시간은 주문할 때 정할 수 있어요</span>
            </span>
          </button>
        </div>
      </div>
      <LegalFooter />
    </main>
  )
}
