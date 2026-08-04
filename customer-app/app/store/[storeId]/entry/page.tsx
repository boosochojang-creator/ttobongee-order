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

  // 주문 확정 게이트에서 넘어온 경우(장바구니 유지 + 선택 후 체크아웃 복귀)인지
  const inOrder = () => { try { return sessionStorage.getItem('tb-order-return') === 'checkout' } catch { return false } }

  const goDineIn = () => {
    if (!inOrder()) clearItems() // 신규 진입만 초기화; 주문 중이면 장바구니 유지
    setOrderType('dine_in')
    router.push(`/store/${storeId}/table`) // 자리선택 → (주문 중이면) 체크아웃 복귀는 table에서 처리
  }
  const goTakeout = () => {
    const ret = inOrder()
    if (!ret) clearItems()
    setTableNo('0')
    setOrderType('takeout')
    if (ret) { try { sessionStorage.removeItem('tb-order-return') } catch {}; router.replace(`/store/${storeId}/checkout`) }
    else router.push(`/store/${storeId}/menu`)
  }

  return (
    <main className="wood-screen">
      <div className="top-bar">
        <span className="logo">🍗 또봉이통닭 백운역점</span>
      </div>

      <div style={{ padding: '32px 20px 40px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>
          {identity === 'known' && greeting ? `${greeting} 👋` : '어서오세요! 👋'}
        </h2>
        <p style={{ fontSize: 16, color: '#e8d4a8', marginBottom: 28, lineHeight: 1.7 }}>
          매장에서 드시나요, 포장하시나요?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420, margin: '0 auto' }}>
          <button onClick={goDineIn} className="wood-tile" style={{
            padding: '26px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, width: '100%',
          }}>
            <span style={{ fontSize: 40 }}>🍗</span>
            <span style={{ textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 900, color: '#FFD86A' }}>매장에서 먹을게요</span>
              <span style={{ display: 'block', fontSize: 13, color: '#e0c88a', marginTop: 4 }}>자리 번호를 고르고 주문해요</span>
            </span>
          </button>

          <button onClick={goTakeout} className="wood-tile" style={{
            padding: '26px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, width: '100%',
          }}>
            <span style={{ fontSize: 40 }}>🛍️</span>
            <span style={{ textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 900, color: '#FFD86A' }}>포장할게요</span>
              <span style={{ display: 'block', fontSize: 13, color: '#e0c88a', marginTop: 4 }}>픽업 시간은 주문할 때 정할 수 있어요</span>
            </span>
          </button>
        </div>

        {/* 1번사진 감성 — 양피지 서명 문구 */}
        <div className="parchment" style={{ maxWidth: 420, margin: '28px auto 0', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.5px' }}>&ldquo;옛날 맛 그대로 추억을 튀깁니다&rdquo;</div>
        </div>
      </div>
      <LegalFooter />
    </main>
  )
}
