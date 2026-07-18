'use client'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useCart } from '../../../lib/cartStore'
import LegalFooter from '../../../lib/LegalFooter'
import { setActiveOrder } from '../../../lib/activeOrder'
import { useStoreId } from '../../../lib/storeContext'

// 모바일 결제 복귀 페이지.
// 결제창(리디렉션)에서 돌아오면 포트원이 paymentId(성공/실패 공통), code·message(실패 시)를
// 쿼리에 붙여준다. 여기서 서버 검증(/api/payment/verify)을 통과해야만 주문상태 화면으로 보낸다.
// PC 결제는 결제창이 같은 화면 위에 떠서 checkout 페이지가 직접 검증하므로 이 페이지를 거치지 않는다.

type Phase = 'verifying' | 'failed'

function PaymentResultContent() {
  const params = useSearchParams()
  const storeId = useStoreId()
  const router = useRouter()
  const orderId = params.get('orderId') || params.get('paymentId')
  const paymentId = params.get('paymentId') || orderId
  const pgCode = params.get('code')          // 값이 있으면 결제창 단계에서 실패/취소
  const pgMessage = params.get('message')
  const phone = params.get('phone') ?? ''

  const [phase, setPhase] = useState<Phase>('verifying')
  const [failReason, setFailReason] = useState('')
  const [canRetry, setCanRetry] = useState(false)
  const ranRef = useRef(false)
  const { clearCart } = useCart()

  const verify = async () => {
    setPhase('verifying')

    // 검증 금액은 URL이 아니라 DB에 저장된 주문 금액을 기준으로 한다 (URL 조작 방지)
    const { data: order } = await supabase
      .from('orders').select('status, final_amount').eq('id', orderId).single()

    if (!order) {
      setFailReason('주문 정보를 찾을 수 없습니다. 직원에게 문의해주세요.')
      setCanRetry(false)
      setPhase('failed')
      return
    }

    // 이미 검증이 끝난 주문(새로고침 등) → 메뉴로 (팝업+음성이 상태를 안내 — 그룹 C)
    if (order.status !== 'pending' && order.status !== 'canceled') {
      clearCart()
      if (orderId) setActiveOrder(orderId)
      router.replace(`/store/${storeId}/menu`)
      return
    }

    const res = await fetch('/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        paymentId,
        expectedAmount: order.final_amount,
      }),
    })
    const data = await res.json().catch(() => ({ ok: false, error: '서버 응답 오류' }))

    if (data.ok) {
      // 결제 확정 → 장바구니 비우고 메뉴로 복귀, 이후 안내는 팝업+음성 (그룹 C)
      clearCart()
      if (orderId) setActiveOrder(orderId)
      router.replace(`/store/${storeId}/menu`)
    } else {
      // 검증 실패: 결제완료로 절대 넘기지 않는다. 이중결제 위험이 있으니 주문 취소도 하지 않고
      // 재확인/직원 문의를 안내한다 (실제로 돈이 빠졌을 수 있는 상태).
      setFailReason(data.error || '결제 확인에 실패했습니다.')
      setCanRetry(true)
      setPhase('failed')
    }
  }

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    if (!orderId) {
      setFailReason('주문 정보를 찾을 수 없습니다.')
      setCanRetry(false)
      setPhase('failed')
      return
    }

    if (pgCode) {
      // 결제창 단계에서 실패·취소하고 돌아온 경우: 아직 결제 전인 주문만 취소 처리
      supabase.from('orders').update({ status: 'canceled' })
        .eq('id', orderId).eq('status', 'pending')
        .then(() => {
          setFailReason(pgMessage || '결제가 취소되었습니다.')
          setCanRetry(false)
          setPhase('failed')
        })
      return
    }

    verify()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'verifying') return (
    <main>
      <div className="top-bar">
        <span className="logo">🍗 또봉이통닭</span>
      </div>
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>결제 확인 중이에요</div>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>
          잠시만 기다려주세요.<br />화면을 닫지 마세요!
        </p>
      </div>
      <LegalFooter />
    </main>
  )

  return (
    <main>
      <div className="top-bar">
        <span className="logo">🍗 또봉이통닭</span>
      </div>
      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😢</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          {canRetry ? '결제 확인에 실패했어요' : '결제가 완료되지 않았어요'}
        </div>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 8 }}>{failReason}</p>
        {canRetry && (
          <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 24, lineHeight: 1.7 }}>
            카드에서 결제된 것 같다면 아래 &lsquo;다시 확인하기&rsquo;를 눌러주세요.<br />
            계속 실패하면 <strong>이중결제 방지를 위해 재주문 전에 직원에게 먼저 문의</strong>해주세요.
          </p>
        )}
        {!canRetry && (
          <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 24 }}>
            결제된 금액은 없으니 다시 주문해주세요.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto' }}>
          {canRetry && (
            <button className="btn-primary" onClick={verify}>
              다시 확인하기
            </button>
          )}
          <button
            className={canRetry ? undefined : 'btn-primary'}
            onClick={() => router.push(`/store/${storeId}/menu`)}
            style={canRetry ? {
              background: 'none', border: '1px solid #555', borderRadius: 10,
              padding: '14px', color: '#aaa', fontSize: 15, cursor: 'pointer',
            } : undefined}
          >
            메뉴로 돌아가기
          </button>
        </div>
      </div>
      <LegalFooter />
    </main>
  )
}

export default function PaymentResultPage() {
  return <Suspense><PaymentResultContent /></Suspense>
}
