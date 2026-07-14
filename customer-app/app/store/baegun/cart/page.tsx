'use client'
import { useRouter } from 'next/navigation'
import { useCart } from '../../../lib/cartStore'
import LegalFooter from '../../../lib/LegalFooter'
import { PAYMENT_ENABLED } from '../../../lib/flags'

const won = (n: number) => n.toLocaleString() + '원'

export default function CartPage() {
  const router = useRouter()
  const { items, updateQty, removeItem, totalAmount, discountAmount, finalAmount, isMember, totalQty } = useCart()

  if (!items.length) return (
    <main>
      <div className="top-bar">
        <button onClick={() => router.back()} style={{ background: 'none', fontSize: 22, color: 'var(--text)' }}>←</button>
        <span style={{ fontWeight: 700 }}>장바구니</span>
      </div>
      <div className="empty-state">
        <span className="icon">🛒</span>
        <p>담은 메뉴가 없어요</p>
        <button className="btn-primary" style={{ marginTop: 16, width: 'auto', padding: '12px 32px' }}
          onClick={() => router.back()}>메뉴 보러 가기</button>
      </div>
      <LegalFooter />
    </main>
  )

  return (
    <main>
      <div className="top-bar">
        <button onClick={() => router.back()} style={{ background: 'none', fontSize: 22, color: 'var(--text)' }}>←</button>
        <span style={{ fontWeight: 700 }}>장바구니 ({totalQty})</span>
      </div>
      <div className="cart-page">
        {items.map(item => (
          <div key={item.id} className="cart-item">
            <div className="cart-item-info">
              <div className="cart-item-name">{item.name}</div>
              <div className="cart-item-price">{won(item.price)} × {item.qty}</div>
            </div>
            <div className="qty-ctrl">
              <button onClick={() => updateQty(item.id, item.qty - 1)}>-</button>
              <span>{item.qty}</span>
              <button className="plus" onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
            </div>
            <button className="cart-delete" onClick={() => removeItem(item.id)}>×</button>
          </div>
        ))}

        <div className="price-summary">
          <div className="price-row">
            <span>합계</span><span>{won(totalAmount)}</span>
          </div>
          {isMember && (
            <div className="price-row discount">
              <span>단골 할인 5%</span><span>-{won(discountAmount)}</span>
            </div>
          )}
          <div className="price-row final">
            <span>결제금액</span><span>{won(finalAmount)}</span>
          </div>
        </div>

        {!isMember && (
          <div className="member-banner" style={{ marginBottom: 16 }}>
            <span className="gift">🎁</span>
            <p><strong>{won(Math.round(totalAmount * 0.05))} 절약</strong>할 수 있어요!</p>
            <button className="link" onClick={() => router.push('/store/baegun/login')}>5% 할인받기</button>
          </div>
        )}

        <button className="btn-primary" onClick={() => router.push('/store/baegun/checkout')}>
          {PAYMENT_ENABLED ? '결제하러 가기' : '주문하러 가기'}
        </button>
      </div>
      <LegalFooter />
    </main>
  )
}
