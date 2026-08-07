'use client'
// [테이블 공유 탭] 일행 합류 안내 팝업(+음성).
//   조건: dine_in로 N번에 앉았는데, 그 테이블에 '이미 미결제 세션'이 있고, 나는 아직 그 세션에 주문이 없을 때 1회.
//   → 먼저 시킨 A는 안 뜸(자기 주문 있음). 나중 들어온 B만 1회.
//   [네] = 합류(이 진입에선 다시 안 뜸)  /  [아니오] = "테이블 번호 확인 · 직원 호출" 안내로 전환.
//   ※ QR 안 찍고 아이콘으로 들어와 번호를 잘못 고른 손님을 바로잡는 용도.
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from './cartStore'
import { useStoreId } from './storeContext'
import { supabase } from './supabase'

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ko-KR'; u.volume = 1; u.rate = 0.95
    window.speechSynthesis.speak(u)
  } catch {}
}

export default function TableSessionJoinPrompt() {
  const { userId, isMember, tableNo, orderType, setTableNo } = useCart()
  const storeId = useStoreId()
  const pathname = usePathname()
  const router = useRouter()
  const [mode, setMode] = useState<null | 'ask' | 'wrongTable'>(null)
  const [staffCalled, setStaffCalled] = useState(false)
  const ran = useRef(false)

  const tableNum = parseInt(String(tableNo ?? ''), 10)
  // 자리선택(/table)·입구(/entry) 화면에선 아직 착석 확정 전 → 팝업 제외. 그 외(메뉴·장바구니·체크아웃 등)에서 노출.
  const onExcludedScreen = pathname === `/store/${storeId}/table` || pathname === `/store/${storeId}/entry`
  const shared = orderType === 'dine_in' && Number.isInteger(tableNum) && tableNum > 0 && !onExcludedScreen
  const todayKst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  const handledKey = `tblJoin-${storeId}-${tableNum}-${todayKst}`
  const markHandled = () => { try { sessionStorage.setItem(handledKey, '1') } catch {} }

  useEffect(() => {
    if (ran.current) return
    if (!isMember || !userId || !shared) return
    ran.current = true
    try { if (sessionStorage.getItem(handledKey) === '1') return } catch {}
    ;(async () => {
      try {
        const r = await fetch(`/api/order/session?tableNo=${tableNum}`, { cache: 'no-store' }).then(x => x.json())
        if (!r?.ok) return
        const rounds: any[] = r.rounds || []
        const iHaveOrder = rounds.some(o => o.userId === userId)
        // 테이블에 미결제 주문이 있고, 내 주문은 아직 없을 때만(=나중 합류자) 안내
        if (rounds.length > 0 && !iHaveOrder) {
          setMode('ask')
          speak(`현재 이용중인 테이블이에요. 아직 결제 전이에요. ${tableNum}번 테이블이 맞으세요?`)
        } else {
          markHandled() // 내가 시작자이거나 이미 합류함 → 다시 안 뜨게
        }
      } catch {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMember, userId, shared, tableNum])

  if (!mode) return null

  const callStaff = () => {
    // 기존 직원호출과 동일 broadcast (customer-calls 채널)
    try {
      const msg = '👋 테이블 번호 확인 요청'
      const ch = supabase.channel('customer-calls')
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.send({ type: 'broadcast', event: 'call', payload: { tableNo, message: msg, speech: '테이블 번호 확인 요청' } })
          setTimeout(() => supabase.removeChannel(ch), 1000)
        }
      })
    } catch {}
    setStaffCalled(true)
    markHandled()
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 400,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  }
  const card: React.CSSProperties = {
    background: 'var(--bg2, #26180b)', border: '1px solid var(--gold-dim, #7a5715)', borderRadius: 16,
    padding: '22px 20px', width: '100%', maxWidth: 360, textAlign: 'center',
    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
  }
  const btnPrimary: React.CSSProperties = {
    flex: 1, padding: '13px', background: 'linear-gradient(150deg,#d6b25a,#bd9a3c 45%,#7a5715)',
    color: '#1f1309', fontWeight: 800, fontSize: 15, border: '1px solid #d6b25a', borderRadius: 10, cursor: 'pointer',
  }
  const btnGhost: React.CSSProperties = {
    flex: 1, padding: '13px', background: 'none', color: '#c6b389', fontSize: 14,
    border: '1px solid #574320', borderRadius: 10, cursor: 'pointer',
  }

  return (
    <div style={overlay}>
      <div style={card}>
        {mode === 'ask' && (
          <>
            <div style={{ fontSize: 34, marginBottom: 6 }}>🍽️</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#FFD700', marginBottom: 8 }}>현재 이용중인 테이블이에요</div>
            <div style={{ fontSize: 14, color: '#e6dcc6', lineHeight: 1.7, marginBottom: 18 }}>
              <b style={{ color: '#FFD700' }}>{tableNum}번 테이블</b>에 아직 결제 전 주문이 있어요.<br />
              이 테이블이 <b>맞으세요?</b> 맞으면 주문이 <b>함께 합산</b>돼요.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={btnPrimary} onClick={() => { markHandled(); setMode(null) }}>네, 같은 테이블이에요</button>
              <button style={btnGhost} onClick={() => {
                // [아니오] = 이 테이블 아님 → 테이블 연결 즉시 해제(공유 종 바로 사라짐) 후 번호 확인 안내
                try { setTableNo('0') } catch {}
                markHandled()
                setMode('wrongTable')
                speak('테이블 위 QR 안내판에서 테이블 번호를 확인해 주세요. 불편하시면 직원을 호출해 주세요.')
              }}>아니오</button>
            </div>
          </>
        )}

        {mode === 'wrongTable' && (
          <>
            <div style={{ fontSize: 34, marginBottom: 6 }}>🔎</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#FFD700', marginBottom: 8 }}>테이블 번호를 확인해 주세요</div>
            <div style={{ fontSize: 14, color: '#e6dcc6', lineHeight: 1.7, marginBottom: 18 }}>
              테이블 위 <b style={{ color: '#FFD700' }}>QR 안내판의 번호</b>를 확인해 주세요.<br />
              불편하시면 <b>직원을 호출</b>해 주세요.
            </div>
            {staffCalled
              ? <div style={{ fontSize: 14, color: '#8ef0b8', fontWeight: 700, marginBottom: 14 }}>✅ 직원을 호출했어요. 잠시만 기다려 주세요.</div>
              : null}
            <div style={{ display: 'flex', gap: 10 }}>
              {!staffCalled && <button style={btnPrimary} onClick={callStaff}>🔔 직원 호출</button>}
              <button style={btnGhost} onClick={() => { setMode(null); router.push(`/store/${storeId}/table`) }}>자리 다시 선택</button>
            </div>
            <button style={{ ...btnGhost, marginTop: 8, width: '100%', flex: 'unset' }} onClick={() => { markHandled(); setMode(null) }}>{staffCalled ? '확인' : '닫기'}</button>
          </>
        )}
      </div>
    </div>
  )
}
