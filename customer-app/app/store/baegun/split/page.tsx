'use client'
// Phase 3: 더치페이 세션 화면 — 각자 폰으로 테이블 QR을 찍고 합류해 자기 몫만 결제.
// 금액은 세션 시작 시점에 확정(합류자 재계산 없음). 이 폰에서 결제를 마치면 버튼을 숨긴다.
// 4초 폴링으로 결제 현황 실시간 표시. 전원 결제 완료 시에만 주방 신호(원 주문 paid)가 나간다.
import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LegalFooter from '../../../lib/LegalFooter'
import { setActiveOrder } from '../../../lib/activeOrder'
import { getMemberLocal } from '../../../lib/memberState'

const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID!
const CHANNEL_KEY: Record<string, string> = {
  card: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_CARD || '',
  kakao: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KAKAO || '',
  toss: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TOSS || '',
}
const won = (n: number) => (n || 0).toLocaleString() + '원'

type SessionRow = {
  id: string; table_order_id: string; total_amount: number; participant_count: number
  amount_per_person: number; last_payer_amount: number; paid_count: number
  is_member_pricing_applied: boolean; status: 'waiting' | 'partial_paid' | 'all_paid'
}

function SplitContent() {
  const params = useSearchParams()
  const router = useRouter()
  const sid = params.get('sid')
  const returnedPaymentId = params.get('paymentId') // 모바일 결제 복귀 (spl_...)
  const returnedCode = params.get('code')

  const [session, setSession] = useState<SessionRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastPopup, setLastPopup] = useState<null | { shareId: string; paymentId: string; amount: number }>(null)
  const [devicePaid, setDevicePaid] = useState(false) // 이 폰에서 결제 완료 여부 (버튼 숨김용)
  const confirmedRef = useRef(false)

  useEffect(() => {
    if (sid) try { setDevicePaid(localStorage.getItem(`ttobongee-split-paid-${sid}`) === '1') } catch {}
  }, [sid])
  const markDevicePaid = () => {
    setDevicePaid(true)
    try { localStorage.setItem(`ttobongee-split-paid-${sid}`, '1') } catch {}
  }

  const refresh = async () => {
    if (!sid) return
    const r = await fetch(`/api/split?sessionId=${sid}`).then(x => x.json()).catch(() => null)
    if (r?.ok) setSession(r.session)
  }

  useEffect(() => {
    if (!sid) return
    refresh()
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [sid]) // eslint-disable-line react-hooks/exhaustive-deps

  // 모바일 결제 복귀 → 몫 결제 확정
  useEffect(() => {
    if (!returnedPaymentId || !returnedPaymentId.startsWith('spl_') || confirmedRef.current) return
    confirmedRef.current = true
    if (returnedCode) { setError('결제가 완료되지 않았어요. 다시 시도해주세요'); return }
    fetch('/api/split', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', paymentId: returnedPaymentId }),
    }).then(x => x.json()).then(r => {
      if (!r.ok) setError(r.error || '결제 확인 실패')
      else markDevicePaid()
      refresh()
    })
  }, [returnedPaymentId, returnedCode]) // eslint-disable-line react-hooks/exhaustive-deps

  // 전원 완료 → 주문 추적 시작 (접수/조리완료 팝업은 기존 감시자가 담당)
  useEffect(() => {
    if (session?.status === 'all_paid') setActiveOrder(session.table_order_id)
  }, [session?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const payShare = async (pre?: { paymentId: string; amount: number }) => {
    if (!sid || loading) return
    setLoading(true); setError('')
    try {
      let paymentId = pre?.paymentId
      let amount = pre?.amount
      if (!paymentId) {
        const m = getMemberLocal()
        const claim = await fetch('/api/split', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'claim', sessionId: sid, memberUserId: m?.userId || null }),
        }).then(x => x.json())
        if (!claim.ok) { setError(claim.error); setLoading(false); return }
        if (claim.isLast) {
          // 마지막 결제자: 잔돈 합산 고지 후 결제 진행
          setLastPopup({ shareId: claim.shareId, paymentId: claim.paymentId, amount: claim.amount })
          setLoading(false)
          return
        }
        paymentId = claim.paymentId
        amount = claim.amount
      }

      const PortOne = await import('@portone/browser-sdk/v2')
      const pgResponse = await PortOne.requestPayment({
        storeId: STORE_ID,
        channelKey: CHANNEL_KEY.card,
        paymentId: paymentId!,
        orderName: `또봉이 더치페이 (${won(amount!)})`,
        totalAmount: amount!,
        currency: 'CURRENCY_KRW',
        redirectUrl: `${window.location.origin}/store/baegun/split?sid=${sid}`,
        payMethod: 'CARD',
        customer: { email: 'guest@ttobongee.com', phoneNumber: '01000000000', fullName: '또봉이고객' },
      })
      if (pgResponse?.code !== undefined) {
        setError(pgResponse.message || '결제가 취소되었어요')
        setLoading(false)
        return
      }
      const r = await fetch('/api/split', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', paymentId: pgResponse?.paymentId ?? paymentId }),
      }).then(x => x.json())
      if (!r.ok) setError(r.error || '결제 확인 실패')
      else markDevicePaid()
      await refresh()
    } catch {
      setError('결제 처리 중 오류가 발생했어요')
    } finally {
      setLoading(false)
    }
  }

  if (!sid) return <main><div style={{ padding: 40, textAlign: 'center', color: '#888' }}>세션 정보가 없어요</div></main>
  if (!session) return <main><div style={{ padding: 40, textAlign: 'center', color: '#888' }}>불러오는 중…</div></main>

  const remaining = session.participant_count - session.paid_count
  const allPaid = session.status === 'all_paid'
  const n = session.participant_count

  return (
    <main>
      <div className="top-bar"><span className="logo">🍗 또봉이통닭</span></div>
      <div style={{ padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {allPaid ? (
          /* [전원 결제 완료] — 확정 문구 */
          <div style={{ background: '#1a1200', border: '1px solid #c8a900', borderRadius: 14, padding: '22px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🔥</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#FFD700', lineHeight: 1.8 }}>
              다 모였다! 주방으로 주문 들어갑니다 🔥<br />
              <span style={{ fontSize: 14, fontWeight: 400, color: '#e0e0e0' }}>맛있게 준비할게요, 조금만 기다려주세요!</span>
            </div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => router.push('/store/baegun/menu')}>
              메뉴로 돌아가기
            </button>
          </div>
        ) : (
          <>
            {/* [더치페이 시작] — 확정 문구 (각자 폰 합류 안내) */}
            <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '16px', fontSize: 14, color: '#e0e0e0', lineHeight: 1.8 }}>
              오늘은 다 같이 {n}분의 1! 🍗<br />
              각자 폰으로 테이블 QR을 찍고 들어오면, 메뉴 화면 위에 뜨는 참여 배너로 합류할 수 있어요.<br />
              다 같이 결제가 끝나야 주방으로 주문이 들어가니, 서두르지 않으셔도 괜찮아요 :)
            </div>

            {/* [결제 대기 중] — 확정 문구 + 실시간 현황 */}
            <div style={{ background: '#101820', border: '1px solid #2a3a4a', borderRadius: 12, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#7fd4ff', marginBottom: 6 }}>
                {session.paid_count}/{n}명 결제 완료
              </div>
              <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.7 }}>
                지금까지 {session.paid_count}명 결제 완료! 나머지 {remaining}분만 기다리고 있어요 🙌<br />
                다 모이면 바로 조리 들어갑니다.
              </div>
            </div>

            {/* 금액 안내 */}
            <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '14px 16px', fontSize: 14, color: '#ccc', lineHeight: 1.9 }}>
              전체 금액 <strong style={{ color: '#FFD700' }}>{won(session.total_amount)}</strong>
              {session.is_member_pricing_applied && <span style={{ color: '#4caf50', fontSize: 12 }}> (단골 5% 적용됨)</span>}
              <br />1인당 <strong style={{ color: '#FFD700' }}>{won(session.amount_per_person)}</strong>
              {session.last_payer_amount !== session.amount_per_person && (
                <span style={{ color: '#888', fontSize: 12 }}> · 마지막 분 {won(session.last_payer_amount)}</span>
              )}
            </div>

            {error && <div style={{ color: 'var(--red)', fontSize: 14 }}>❌ {error}</div>}

            {devicePaid ? (
              /* 이 폰의 몫은 결제 완료 — 각자 폰 합류만 안내 (버튼 재노출 없음) */
              <div style={{ background: '#0d1a0d', border: '1px solid #2e5c2e', borderRadius: 12, padding: '16px', textAlign: 'center', fontSize: 14, color: '#8fd48f', lineHeight: 1.8 }}>
                ✅ 내 몫 결제 완료!<br />
                <span style={{ color: '#aaa', fontSize: 13 }}>아직 결제 안 하신 분들은 각자 폰으로 테이블 QR을 찍고 참여해주세요.</span>
              </div>
            ) : (
              <button className="btn-primary" onClick={() => payShare()} disabled={loading}>
                {loading ? '처리 중...' : '💳 내 몫 결제하기'}
              </button>
            )}
          </>
        )}
      </div>

      {/* [마지막 결제자] — 확정 문구 팝업 */}
      {lastPopup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 340, background: '#1c1c1c', border: '1px solid #c8a900', borderRadius: 18, padding: '26px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🙋‍♀️</div>
            <div style={{ fontSize: 14, color: '#e0e0e0', lineHeight: 1.9, textAlign: 'left' }}>
              마지막이시네요! 🙋‍♀️<br />
              나눠떨어지지 않는 잔돈(몇십 원 이내)은 마지막 분 몫에 살짝 더해져요.<br />
              딱 맞춰드리고 싶지만 이게 제일 빠르고 깔끔하더라고요 😊
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#FFD700', margin: '14px 0' }}>
              결제 금액: {won(lastPopup.amount)}
            </div>
            <button className="btn-primary" onClick={() => { const p = lastPopup; setLastPopup(null); payShare({ paymentId: p.paymentId, amount: p.amount }) }}>
              확인하고 결제하기
            </button>
          </div>
        </div>
      )}
      <LegalFooter />
    </main>
  )
}

export default function SplitPage() {
  return <Suspense><SplitContent /></Suspense>
}
