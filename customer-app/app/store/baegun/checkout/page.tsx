'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '../../../lib/cartStore'
import { supabase } from '../../../lib/supabase'
import LegalFooter from '../../../lib/LegalFooter'
import { setActiveOrder } from '../../../lib/activeOrder'

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

// 카카오페이·토스페이는 채널키가 환경변수에 등록된 경우에만 노출.
// 키 없이 결제를 호출하면 포트원 에러가 나므로, 실연동 채널 등록 후 env 추가 + 재배포만 하면 자동으로 켜진다.
const VISIBLE_PAY_OPTIONS = PAY_OPTIONS.filter(
  o => o.key === 'card' || o.key === 'cash' || CHANNEL_KEY[o.key] !== ''
)

export default function CheckoutPage() {
  const router = useRouter()
  const { items, tableNo, orderType, isMember, userId, phone, totalAmount, discountAmount, finalAmount, clearCart } = useCart()
  const [payMethod, setPayMethod] = useState<PayMethod>('card')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ===== Phase 3: 더치페이 (홀 주문 전용) =====
  const [splitModal, setSplitModal] = useState(false)
  const [splitN, setSplitN] = useState('')
  const [splitLoading, setSplitLoading] = useState(false)

  const handleSplitStart = async () => {
    const n = Math.floor(Number(splitN))
    if (!n || n < 2 || n > 20) { setError('인원수는 2~20명으로 입력해주세요'); return }
    if (!items.length || splitLoading) return
    setSplitLoading(true); setError('')
    try {
      // 원 주문 생성 (결제 전 pending — 전원 결제 완료 시에만 주방으로 넘어감)
      const { data: order, error: orderErr } = await supabase.from('orders').insert({
        store_id: 'baegun', table_no: Number(tableNo), order_type: 'dine_in', status: 'pending',
        total_amount: totalAmount, discount_amount: discountAmount, final_amount: finalAmount,
        payment_method: 'split', user_id: userId, is_member: isMember,
      }).select('id').single()
      if (orderErr || !order) throw orderErr
      const orderItems = items.map(i => ({
        order_id: order.id, menu_id: i.id, name_snapshot: i.name,
        price_snapshot: i.price, qty: i.qty, subtotal: i.price * i.qty,
      }))
      const { error: itemErr } = await supabase.from('order_items').insert(orderItems)
      if (itemErr) throw itemErr

      const r = await fetch('/api/split', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', orderId: order.id, participantCount: n }),
      }).then(x => x.json())
      if (!r.ok) throw new Error(r.error)
      clearCart()
      router.push(`/store/baegun/split?sid=${r.sessionId}`)
    } catch (e: any) {
      setError(e?.message || '더치페이 시작에 실패했어요. 다시 시도해주세요')
      setSplitLoading(false)
    }
  }

  // ===== Phase 2: 배달 주문 =====
  const [isDelivery, setIsDelivery] = useState(false)
  const [addr, setAddr] = useState('')            // 도로명주소
  const [addrDetail, setAddrDetail] = useState('') // 상세주소 (동/호수)
  const [contactPhone, setContactPhone] = useState(phone || '')
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null)
  const [deliveryDistanceM, setDeliveryDistanceM] = useState<number | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError, setCalcError] = useState('')
  const [farNotice, setFarNotice] = useState(false) // 20km 초과 안내 (차단 아님)

  // 최종 결제금액 = 장바구니 총액 + 배달료
  const payTotal = finalAmount + (isDelivery && deliveryFee ? deliveryFee : 0)
  const canSplit = !isDelivery && orderType === 'dine_in' // 더치페이는 홀 주문 전용 (포장/배달 제외)

  // 배달료 계산 (실주행거리 기반, 서버 API)
  const calcDeliveryFee = async (roadAddr: string) => {
    if (!roadAddr || roadAddr.trim().length < 5) { setCalcError('주소를 먼저 입력해주세요'); return }
    setCalcLoading(true); setCalcError(''); setDeliveryFee(null)
    try {
      const res = await fetch('/api/delivery-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: roadAddr }),
      })
      const data = await res.json()
      if (!data.ok) { setCalcError(data.error || '배달료 계산에 실패했어요'); return }
      setDeliveryFee(data.fee)
      setDeliveryDistanceM(data.distanceM)
      if (data.farNotice) setFarNotice(true)
    } catch {
      setCalcError('배달료 계산에 실패했어요. 다시 시도해주세요')
    } finally {
      setCalcLoading(false)
    }
  }

  // 다음(카카오) 우편번호 검색 팝업 — 키 없이 무료
  const openPostcode = () => {
    const launch = () => new (window as any).daum.Postcode({
      oncomplete: (data: any) => {
        const road = data.roadAddress || data.address
        setAddr(road)
        setDeliveryFee(null)
        calcDeliveryFee(road)
      },
    }).open()
    if ((window as any).daum?.Postcode) { launch(); return }
    const s = document.createElement('script')
    s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    s.onload = launch
    document.body.appendChild(s)
  }

  // 모바일에서 결제창(리디렉션)으로 갔다가 결제 없이 뒤로가기로 돌아오면 브라우저가
  // 이전 화면을 그대로 복원(bfcache)해서 '결제창 열리는 중...' 상태에 갇힌다 → 복원 감지 시 버튼 원복.
  // PC 팝업 흐름은 페이지 이동이 없어 persisted 이벤트가 발생하지 않으므로 영향 없음.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setLoading(false)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  const handleOrder = async () => {
    if (!items.length) return
    // 배달 주문 필수 항목 검증 (배달료 계산까지 완료돼야 결제 진행)
    if (isDelivery) {
      const digits = contactPhone.replace(/\D/g, '')
      if (!addr.trim()) { setError('배달 주소를 입력해주세요'); return }
      if (digits.length < 10) { setError('연락처를 정확히 입력해주세요'); return }
      if (deliveryFee === null) { setError('배달료 계산을 먼저 해주세요 (주소 검색 시 자동 계산)'); return }
    }
    setLoading(true)
    setError('')

    // 1. 주문 생성
    const status = payMethod === 'cash' ? 'cash_pending' : 'pending'
    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      store_id: 'baegun',
      table_no: isDelivery ? 0 : Number(tableNo),
      order_type: isDelivery ? 'delivery' : orderType,
      status,
      total_amount: totalAmount,
      discount_amount: discountAmount,
      final_amount: payTotal, // 배달이면 배달료 포함 (결제 검증도 이 금액 기준)
      payment_method: payMethod,
      user_id: userId,
      is_member: isMember,
      ...(isDelivery ? {
        delivery_address: `${addr.trim()} ${addrDetail.trim()}`.trim(),
        delivery_fee: deliveryFee,
        delivery_distance_m: deliveryDistanceM,
        customer_phone: contactPhone.replace(/\D/g, ''),
      } : {}),
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

    // 3. 현금 결제 → 메뉴로 복귀 (별도 화면 없이 팝업+음성으로 안내 — 그룹 C)
    if (payMethod === 'cash') {
      clearCart()
      setActiveOrder(order.id)
      router.push('/store/baegun/menu')
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
        totalAmount: payTotal,
        currency: 'CURRENCY_KRW',
        // 모바일은 결제창으로 페이지가 통째로 이동했다 돌아오는 리디렉션 방식이라 복귀 주소가 필수.
        // PC(iframe/팝업)에서는 SDK가 이 값을 무시하므로 기존 흐름에 영향 없음.
        redirectUrl: `${window.location.origin}/store/baegun/payment-result?orderId=${order.id}${phone ? `&phone=${encodeURIComponent(phone)}` : ''}`,
        payMethod: payMethod === 'card' ? 'CARD' : 'EASY_PAY',
        ...(payMethod !== 'card' && {
          easyPay: {
            easyPayProvider: payMethod === 'kakao' ? 'KAKAOPAY' : 'TOSSPAY',
          },
        }),
        customer: {
          email: 'guest@ttobongee.com',
          phoneNumber: isMember && phone ? phone : '01000000000',
          fullName: '또봉이고객',
        },
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
      setActiveOrder(order.id)
      router.push('/store/baegun/menu')
    } catch (e: any) {
      console.error('[checkout] 결제 처리 오류:', e)
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
        {/* 받는 방법 (Phase 2: 배달) */}
        <div className="section-title">받는 방법</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => { setIsDelivery(false); setError('') }} style={{
            flex: 1, padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            background: !isDelivery ? '#c8a900' : 'none', color: !isDelivery ? '#111' : '#aaa',
            border: !isDelivery ? 'none' : '1px solid #444',
          }}>🏪 {orderType === 'takeout' ? '포장' : '매장에서'}</button>
          <button onClick={() => { setIsDelivery(true); setError('') }} style={{
            flex: 1, padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            background: isDelivery ? '#c8a900' : 'none', color: isDelivery ? '#111' : '#aaa',
            border: isDelivery ? 'none' : '1px solid #444',
          }}>🛵 배달로</button>
        </div>

        {isDelivery && (
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="도로명주소 (검색 버튼을 눌러주세요)" value={addr}
                onChange={e => { setAddr(e.target.value); setDeliveryFee(null) }}
                style={{ flex: 1, background: '#111', border: '1px solid #444', borderRadius: 8, padding: '11px 12px', color: '#f0f0f0', fontSize: 14, outline: 'none' }} />
              <button onClick={openPostcode} style={{
                padding: '11px 14px', background: '#333', color: '#f0f0f0', fontSize: 13, fontWeight: 700,
                border: '1px solid #555', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>🔍 주소 검색</button>
            </div>
            <input type="text" placeholder="상세주소 (동/호수)" value={addrDetail} onChange={e => setAddrDetail(e.target.value)}
              style={{ background: '#111', border: '1px solid #444', borderRadius: 8, padding: '11px 12px', color: '#f0f0f0', fontSize: 14, outline: 'none' }} />
            <input type="tel" inputMode="numeric" placeholder="연락처 (예: 01012345678)" value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              style={{ background: '#111', border: '1px solid #444', borderRadius: 8, padding: '11px 12px', color: '#f0f0f0', fontSize: 14, outline: 'none' }} />
            {deliveryFee === null && !calcLoading && addr.trim().length >= 5 && (
              <button onClick={() => calcDeliveryFee(addr)} style={{
                padding: '11px', background: '#1a1200', color: '#FFD700', fontSize: 14, fontWeight: 700,
                border: '1px solid #7a6400', borderRadius: 8, cursor: 'pointer',
              }}>🛵 배달료 계산하기</button>
            )}
            {calcLoading && <div style={{ fontSize: 13, color: '#888' }}>배달료 계산 중… (실주행거리 기준)</div>}
            {calcError && <div style={{ fontSize: 13, color: 'var(--red)' }}>{calcError}</div>}
            {deliveryFee !== null && (
              <div style={{ fontSize: 14, color: '#ccc' }}>
                🛵 배달료 <strong style={{ color: '#FFD700' }}>{won(deliveryFee)}</strong>
                <span style={{ color: '#777', fontSize: 12 }}> · 실주행 약 {((deliveryDistanceM || 0) / 1000).toFixed(1)}km</span>
              </div>
            )}
          </div>
        )}

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
            {isDelivery && deliveryFee !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text2)' }}>
                <span>🛵 배달료</span><span>+{won(deliveryFee)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, marginTop: 8 }}>
              <span>최종 결제</span><span style={{ color: 'var(--gold)' }}>{won(payTotal)}</span>
            </div>
          </div>
        </div>

        {/* 결제 수단 */}
        <div className="section-title">결제 수단</div>
        <div className="pay-methods">
          {VISIBLE_PAY_OPTIONS.map(o => (
            <button key={o.key} className={`pay-btn${payMethod === o.key ? ' selected' : ''}`}
              onClick={() => { setPayMethod(o.key); setError('') }}>
              <span className="pay-icon">{o.icon}</span>
              {o.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#777', marginTop: 8 }}>
          카카오페이·토스페이·네이버페이 준비 중이에요 🙏
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

        {/* 더치페이 (홀 주문 전용 — 포장/배달에는 노출 안 함) */}
        {canSplit && (
          <button
            onClick={() => { setSplitModal(true); setError('') }}
            style={{
              width: '100%', marginTop: 16, padding: '13px',
              background: 'none', color: '#FFD700', fontSize: 14, fontWeight: 700,
              border: '1px solid #7a6400', borderRadius: 10, cursor: 'pointer',
            }}
          >
            🍗 더치페이로 나눠 내기 (n분의 1)
          </button>
        )}

        <div style={{ height: 12 }} />
        <button className="btn-primary" onClick={handleOrder} disabled={loading}>
          {loading
            ? payMethod === 'cash' ? '주문 접수 중...' : '결제창 열리는 중...'
            : `${won(payTotal)} ${payMethod === 'cash' ? '주문하기' : '결제하기'}`}
        </button>

        <LegalFooter />
      </div>

      {/* 더치페이 인원수 입력 */}
      {splitModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 320, background: '#1c1c1c', border: '1px solid #c8a900', borderRadius: 18, padding: '26px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🍗</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#f0f0f0', marginBottom: 14 }}>몇 분이서 나누실까요?</div>
            <input
              type="number" inputMode="numeric" min={2} max={20} placeholder="인원수 (2~20)"
              value={splitN} onChange={e => setSplitN(e.target.value)}
              style={{ width: '100%', background: '#111', border: '1px solid #444', borderRadius: 10, padding: '12px 14px', color: '#f0f0f0', fontSize: 16, outline: 'none', textAlign: 'center' }}
            />
            {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{error}</div>}
            <button className="btn-primary" style={{ marginTop: 14 }} onClick={handleSplitStart} disabled={splitLoading}>
              {splitLoading ? '시작하는 중...' : '더치페이 시작'}
            </button>
            <button
              onClick={() => setSplitModal(false)}
              style={{ width: '100%', marginTop: 8, padding: '10px', background: 'none', color: '#888', fontSize: 13, border: 'none', cursor: 'pointer' }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 20km 초과 안내 (확정 문구 — 주문 차단 아님, 확인 후 계속 진행) */}
      {farNotice && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            width: '100%', maxWidth: 360, background: '#1c1c1c', border: '1px solid #c8a900',
            borderRadius: 18, padding: '26px 22px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 10 }}>🛵💨</div>
            <div style={{ fontSize: 14, color: '#e0e0e0', lineHeight: 1.8 }}>
              와, 멀리서도 저희 매장을 찾아주셔서 감사해요! 다만 거리가 있다 보니 배달 시간이 걸려서,
              튀김류 특성상 매장에서 바로 드시는 것보다 식감이 조금 눅눅해질 수 있어요 🙏
              그 점 참고 부탁드리고, 혹시 근처에 다른 맛집이 있으시다면 그쪽도 한번 이용해보시는 것도
              좋을 것 같아요. 그래도 또봉이가 먹고 싶으시다면, 정성껏 배달해드릴게요!
            </div>
            <button className="btn-primary" style={{ marginTop: 18 }} onClick={() => setFarNotice(false)}>
              확인
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
