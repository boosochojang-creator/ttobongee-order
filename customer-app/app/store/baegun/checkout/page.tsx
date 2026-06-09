'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '../../../lib/cartStore'
import { supabase } from '../../../lib/supabase'
import LegalFooter from '../../../lib/LegalFooter'

type PayMethod = 'card' | 'kakao' | 'toss' | 'cash'
const won = (n: number) => n.toLocaleString() + '원'

const PAY_OPTIONS: { key: PayMethod; icon: string; label: string }[] = [
  { key: 'card', icon: '💳', label: '신용/체크카드' },
  { key: 'kakao', icon: '💛', label: '카카오페이' },
  { key: 'toss', icon: '💙', label: '토스페이' },
  { key: 'cash', icon: '💵', label: '현금결제' },
]

const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID!

const CHANNEL_KEY: Record<string, string> = {
  card: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_CARD || '',
  kakao: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KAKAO || '',
  toss: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TOSS || '',
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, tableNo, orderType, isMember, userId, phone, totalAmount, discountAmount, finalAmount, clearCart } = useCart()
  const [payMethod, setPayMethod] = useState<PayMethod>('card')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleOrder = async () => {
    if (!items.length) return
    setLoading(true)
    setError('')

    // 1. 주문 생성
    const status = payMethod === 'cash' ? 'cash_pending' : 'pending'
    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      store_id: 'baegun',
      table_no: Number(tableNo),
      order_type: orderType,
      status,
      total_amount: totalAmount,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      payment_method: payMethod,
      user_id: userId,
      is_member: isMember,
    }).select('id').single()

    if (orderErr || !order) {
      setError('주문 접수 중 오류가 발생했어요. 다시 시도해주세요.')
      setLoading(false)
      return
    }

    // 2. 주문 상세 저장
    const orderItems = items.map(i => ({
      order_id: order.id,
      menu_id: i.id,
      name_snapshot: i.name,
      price_snapshot: i.price,
      qty: i.qty,
      subtotal: i.price * i.qty,
    }))
    const { error: itemErr } = await supabase.from('order_items').insert(orderItems)
    if (itemErr) {
      setError('주문 접수 중 오류가 발생했어요. 다시 시도해주세요.')
      setLoading(false)
      return
    }

    // 3. 현금 결제 → 바로 대기화면
    if (payMethod === 'cash') {
      clearCart()
      router.push(`/store/baegun/order-status?id=${order.id}&cash=1${phone ? `&phone=${encodeURIComponent(phone)}` : ''}`)
      return
    }

    // 4. 전자결제 → PortOne V2 결제창 호출
    try {
      const PortOne = await import('@portone/browser-sdk/v2')

      const orderName = items.map(i => i.name).join(', ').slice(0, 100)

      const pgResponse = await PortOne.requestPayment({
        storeId: STORE_ID,
        channelKey: CHANNEL_KEY[payMethod],
        paymentId: order.id,
        orderName,
        totalAmount: finalAmount,
        currency: 'CURRENCY_KRW',
        payMethod: payMethod === 'card' ? 'CARD' : 'EASY_PAY',
        ...(payMethod !== 'card' && {
          easyPay: {
            easyPayProvider: payMethod === 'kakao' ? 'KAKAOPAY' : 'TOSSPAY',
          },
        }),
      })

      // 결제 취소 또는 실패
      if (pgResponse?.code !== undefined) {
        await supabase.from('orders').update({ status: 'canceled' }).eq('id', order.id)
        setError(pgResponse.message || '결제가 취소되었습니다')
        setLoading(false)
        return
      }

      // 5. 서버 검증
      const verifyRes = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          paymentId: pgResponse?.paymentId ?? order.id,
          expectedAmount: finalAmount,
        }),
      })

      const verifyData = await verifyRes.json()
      if (!verifyData.ok) {
        setError(verifyData.error || '결제 검증에 실패했습니다')
        setLoading(false)
        return
      }

      clearCart()
      router.push(`/store/baegun/order-status?id=${order.id}${phone ? `&phone=${encodeURIComponent(phone)}` : ''}`)
    } catch (e: any) {
      setError('결제 처리 중 오류가 발생했어요. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  return (
    <main>
      <div className="top-bar">
        <button onClick={() => router.back()} style={{ background: 'none', fontSize: 22, color: 'var(--text)' }}>←</button>
        <span style={{ fontWeight: 700 }}>결제하기</span>
      </div>
      <div className="checkout-page">
        {/* 주문 요약 */}
        <div className="section-title">주문 내역</div>
        <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 20 }}>
          {items.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
              <span>{i.name} × {i.qty}</span>
              <span>{won(i.price * i.qty)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
            <div className="price-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text2)' }}>
              <span>합계</span><span>{won(totalAmount)}</span>
            </div>
            {isMember && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--green)' }}>
                <span>단골 할인 5%</span><span>-{won(discountAmount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, marginTop: 8 }}>
              <span>최종 결제</span><span style={{ color: 'var(--gold)' }}>{won(finalAmount)}</span>
            </div>
          </div>
        </div>

        {/* 결제 수단 */}
        <div className="section-title">결제 수단</div>
        <div className="pay-methods">
          {PAY_OPTIONS.map(o => (
            <button key={o.key} className={`pay-btn${payMethod === o.key ? ' selected' : ''}`}
              onClick={() => { setPayMethod(o.key); setError('') }}>
              <span className="pay-icon">{o.icon}</span>
              {o.label}
            </button>
          ))}
        </div>

        {/* 현금 안내 */}
        {payMethod === 'cash' && (
          <div style={{
            background:'#1a1200', border:'2px solid #c8a900',
            borderRadius:12, padding:'20px 18px', marginTop:16,
            fontSize:16, lineHeight:2, fontWeight:600, color:'#f0f0f0'
          }}>
            <div style={{fontSize:20, fontWeight:900, color:'#c8a900', marginBottom:8}}>
              💵 현금 결제를 선택하셨습니다!
            </div>
            😊 주문 완료 후{' '}
            <span style={{color:'#FFD700', fontWeight:700}}>카운터에서 결제</span>해 주시면<br/>
            맛있는 치킨 조리가{' '}
            <span style={{color:'#FF6B00', fontWeight:700}}>바로 시작</span>됩니다 👨‍🍳<br/>
            <span style={{fontSize:14, color:'#888', fontWeight:400}}>
              ※ 결제 전 자리를 이동하지 말아 주세요
            </span>
          </div>
        )}

        {error && (
          <div style={{
            background:'#2a0a0a', border:'1px solid #e84040',
            borderRadius:10, padding:'12px 14px',
            color:'#e84040', fontSize:14, marginTop:16
          }}>
            ❌ {error}
          </div>
        )}

        {/* 약관 동의 안내 */}
        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.9, marginTop: 16, marginBottom: 4 }}>
          주문하기 버튼을 누르면{' '}
          <a href="/terms" style={{ color: '#888', textDecoration: 'underline' }}>이용약관</a>,{' '}
          <a href="/privacy" style={{ color: '#888', textDecoration: 'underline' }}>개인정보처리방침</a>,{' '}
          <a href="/refund" style={{ color: '#888', textDecoration: 'underline' }}>환불정책</a>에{' '}
          동의한 것으로 간주됩니다.
        </div>

        <div style={{ height: 12 }} />
        <button className="btn-primary" onClick={handleOrder} disabled={loading}>
          {loading
            ? payMethod === 'cash' ? '주문 접수 중...' : '결제창 열리는 중...'
            : `${won(finalAmount)} ${payMethod === 'cash' ? '주문하기' : '결제하기'}`}
        </button>

        <LegalFooter />
      </div>
    </main>
  )
}
