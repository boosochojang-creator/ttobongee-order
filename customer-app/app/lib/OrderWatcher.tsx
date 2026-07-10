'use client'

// 그룹 C: 주문 상태 감시자 — 별도 화면 이동 없이, 지금 보는 화면 위에 팝업 + 음성 안내.
// 접수(accepted)/조리완료(done) 시 팝업, 취소(canceled) 시 안내 팝업.
// 음성은 실패해도(음소거·미지원) 팝업은 항상 뜬다.
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from './supabase'
import { getActiveOrder, clearActiveOrder } from './activeOrder'

type Status = 'pending' | 'paid' | 'cash_pending' | 'accepted' | 'cooking' | 'done' | 'served' | 'canceled'

const CHIP_LABEL: Partial<Record<Status, string>> = {
  pending: '🍗 주문 확인 중...',
  paid: '🍗 주문 확인 중...',
  cash_pending: '💵 카운터에서 결제해주세요',
  accepted: '✅ 접수 완료 · 곧 조리 시작해요',
  cooking: '🍳 맛있게 조리 중...',
  done: '🛎️ 나왔어요! 맛있게 드세요',
}

function speak(text: string) {
  // 음성 실패는 조용히 무시 — 팝업 노출과 무관해야 함 (무음 모드 대응)
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ko-KR'; u.volume = 1; u.rate = 0.9
    window.speechSynthesis.speak(u)
  } catch {}
}

export default function OrderWatcher() {
  const pathname = usePathname()
  const [status, setStatus] = useState<Status | null>(null)
  const [popup, setPopup] = useState<null | 'accepted' | 'done' | 'canceled'>(null)
  const [cancelReason, setCancelReason] = useState('') // 점주가 선택한 거절 사유 (신규B)
  const prevStatus = useRef<Status | null>(null)
  const watchingId = useRef<string | null>(null)

  // 주문은 화면 이동(SPA) 직후 생기므로, 경로가 바뀔 때마다 활성 주문을 다시 확인한다
  useEffect(() => {
    const active = getActiveOrder()
    if (!active) { watchingId.current = null; setStatus(null); return }
    if (watchingId.current !== active.orderId) {
      // 새 주문 감시 시작 → 이전 주문의 상태 기록 초기화
      watchingId.current = active.orderId
      prevStatus.current = null
    }
    const orderId = active.orderId

    const apply = (s: Status, reason?: string | null) => {
      if (s === 'canceled') setCancelReason((reason || '').trim())
      if (s === prevStatus.current) return
      const prev = prevStatus.current
      prevStatus.current = s
      setStatus(s)

      // 첫 조회(prev=null)에서는 팝업 대신 칩만 — 새로고침 때 팝업이 중복으로 뜨지 않게
      if (prev === null) {
        if (s === 'served' || s === 'canceled') clearActiveOrder()
        return
      }
      if (s === 'accepted') {
        setPopup('accepted')
        speak('주문이 접수되었습니다. 잠시만 기다려주세요')
      } else if (s === 'done') {
        setPopup('done')
        speak('조리가 완료되었습니다. 맛있게 드세요')
      } else if (s === 'canceled') {
        setPopup('canceled')
        clearActiveOrder()
      } else if (s === 'served') {
        clearActiveOrder()
        setStatus(null)
      }
    }

    // 실시간 + 8초 폴링 이중 구조 (기존 패턴)
    const ch = supabase.channel(`watch-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}`,
      }, payload => apply(payload.new.status as Status, payload.new.cancel_reason as string | null))
      .subscribe()

    const fetchStatus = async () => {
      // 상태는 항상 조회(컬럼 확실). 취소 사유는 별도 best-effort — cancel_reason 컬럼 미존재(마이그레이션 전)여도 상태표시가 깨지지 않게 분리.
      const { data } = await supabase.from('orders').select('status').eq('id', orderId).single()
      if (!data) return
      if (data.status === 'canceled') {
        const r = await supabase.from('orders').select('cancel_reason').eq('id', orderId).single()
        apply('canceled', r.error ? null : (r.data?.cancel_reason as string | null))
      } else {
        apply(data.status as Status)
      }
    }
    fetchStatus()
    const poll = setInterval(fetchStatus, 8000)

    return () => { supabase.removeChannel(ch); clearInterval(poll) }
  }, [pathname])

  const POPUPS = {
    accepted: { icon: '✅', title: '주문이 접수되었습니다', desc: '주방에서 확인했어요. 곧 조리를 시작합니다!' },
    done: { icon: '🍗', title: '조리가 완료되었습니다', desc: '주문하신 메뉴가 나왔어요. 맛있게 드세요!' },
    canceled: { icon: '😢', title: '주문이 취소되었어요', desc: '불편을 드려 죄송합니다. 직원에게 문의해주세요.' },
  }

  return (
    <>
      {/* 진행 상태 칩 — 화면 이동 없이 현재 상태만 작게 표시 */}
      {status && status !== 'served' && status !== 'canceled' && CHIP_LABEL[status] && (
        <div style={{
          position: 'fixed', top: 64, left: 12, zIndex: 240,
          background: '#1c1c1c', border: '1px solid #444', borderRadius: 100,
          padding: '7px 12px', fontSize: 12, fontWeight: 700, color: '#e0e0e0',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        }}>
          {CHIP_LABEL[status]}
        </div>
      )}

      {/* 접수/조리완료/취소 팝업 */}
      {popup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            width: '100%', maxWidth: 340, background: '#1c1c1c',
            border: '1px solid #c8a900', borderRadius: 18, padding: '28px 22px',
            textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>{POPUPS[popup].icon}</div>
            <div style={{ fontSize: 19, fontWeight: 900, color: '#f0f0f0', marginBottom: 8 }}>
              {POPUPS[popup].title}
            </div>
            <div style={{ fontSize: 14, color: '#aaa', lineHeight: 1.7, marginBottom: 20 }}>
              {popup === 'canceled' && cancelReason
                ? <>사유: <span style={{ color: '#f0d890', fontWeight: 700 }}>{cancelReason}</span><br />불편을 드려 죄송합니다. 궁금한 점은 직원에게 문의해주세요.</>
                : POPUPS[popup].desc}
            </div>
            <button className="btn-primary" onClick={() => setPopup(null)}>
              확인
            </button>
          </div>
        </div>
      )}
    </>
  )
}
