'use client'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import LegalFooter from '../../../lib/LegalFooter'
import { useStoreId } from '../../../lib/storeContext'

type Status = 'pending' | 'paid' | 'cash_pending' | 'accepted' | 'cooking' | 'done' | 'served' | 'canceled'

type SessionItem = { name: string; qty: number }

const STEPS: { key: Status[]; icon: string; label: string; desc: string }[] = [
  { key: ['pending', 'paid', 'cash_pending'], icon: '📋', label: '주문 접수', desc: '주방에서 확인 중이에요' },
  { key: ['accepted'], icon: '✅', label: '주문 확인', desc: '주방에서 확인했어요!' },
  { key: ['cooking'], icon: '🍗', label: '맛있게 조리 중', desc: '바삭바삭 튀기는 중이에요' },
  { key: ['done'], icon: '🛎️', label: '완료!', desc: '나왔어요! 맛있게 드세요 😊' },
]

const FORTUNES = [
  '오늘 치킨 먹으면 복이 온대요 🍗',
  '바삭함이 행복의 소리래요 🔊',
  '생맥주 한 잔의 여유, 오늘 수고했어요 🍺',
  '또봉이 치킨은 당신의 하루를 응원합니다 💛',
  '치킨 기름 냄새가 행복의 냄새라는 설이 있대요',
  '잠깐의 기다림이 바삭한 행복이 됩니다',
  '오늘 치킨 안 먹었으면 후회할 뻔 했어요 😄',
  '백운역 최고의 치킨집에 오신 걸 환영해요 🏆',
  '이 치킨, 오늘 당신 것입니다 👑',
  '곧 나옵니다! 조금만 더 기다려주세요 🙏',
]

function StatusContent() {
  const params = useSearchParams()
  const storeId = useStoreId()
  const router = useRouter()
  const orderId = params.get('id')
  const isCash = params.get('cash') === '1'
  const memberPhone = params.get('phone') ?? ''
  const [status, setStatus] = useState<Status>('pending')
  const [cancelReason, setCancelReason] = useState('') // 점주가 선택한 거절 사유 (신규B)
  const [gifts, setGifts] = useState<{ menu: string; qty: number }[]>([]) // 이 주문의 무료 증정 메뉴
  // A2: 결제완료(served) 시 이 테이블 세션의 누적 주문내역 + 총액
  const [session, setSession] = useState<{ items: SessionItem[]; gifts: SessionItem[]; total: number; orderCount: number } | null>(null)
  const [fortune] = useState(() => FORTUNES[Math.floor(Math.random() * FORTUNES.length)])
  const prevStatus = useRef<Status | null>(null)
  const [receiptPhone, setReceiptPhone] = useState(memberPhone)
  const [receiptSent, setReceiptSent] = useState(false)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptError, setReceiptError] = useState('')
  const [showReceiptInput, setShowReceiptInput] = useState(false)
  // v1.4: PWA 설치 유도 문구 비활성화 (PWAPrompt.tsx 참조 — 구조 보존)
  // const [showInstallTip, setShowInstallTip] = useState(false)
  const autoSentRef = useRef(false)

  const sendReceipt = async (phone: string) => {
    setReceiptLoading(true); setReceiptError('')
    const res = await fetch('/api/send-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, phone }),
    })
    const data = await res.json()
    setReceiptLoading(false)
    if (data.ok) { setReceiptSent(true); setShowReceiptInput(false) }
    else setReceiptError(data.error || '발송 실패')
  }

  // 회원: 가입 시 등록한 전화번호로 영수증 자동 발송
  useEffect(() => {
    if (autoSentRef.current) return
    if (!orderId || !memberPhone) return
    autoSentRef.current = true
    sendReceipt(memberPhone)
  }, [orderId, memberPhone])

  // v1.4: PWA 설치 유도 문구 비활성화 (PWAPrompt.tsx 참조 — 구조 보존)
  // useEffect(() => {
  //   if (localStorage.getItem('pwa-installed') !== '1') setShowInstallTip(true)
  // }, [])

  useEffect(() => {
    if (!orderId) return

    // 아렌 제안: Realtime + 폴링 이중 구조
    const channel = supabase.channel(`order-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `id=eq.${orderId}`
      }, payload => {
        setStatus(payload.new.status as Status)
        setCancelReason((payload.new.cancel_reason as string | null) || '')
      })
      .subscribe()

    // 상태는 항상 조회, 취소 사유는 별도 best-effort (cancel_reason 컬럼 미존재여도 상태표시 안 깨지게 분리)
    const loadReason = async () => {
      const r = await supabase.from('orders').select('cancel_reason').eq('id', orderId).single()
      if (!r.error && r.data) setCancelReason((r.data.cancel_reason as string | null) || '')
    }

    // 폴링 백업 (아렌: 누락 복구)
    const poll = setInterval(async () => {
      const { data } = await supabase.from('orders').select('status').eq('id', orderId).single()
      if (data) { setStatus(data.status as Status); if (data.status === 'canceled') loadReason() }
    }, 8000)

    // 초기 조회
    supabase.from('orders').select('status').eq('id', orderId).single()
      .then(({ data }) => { if (data) { setStatus(data.status as Status); if (data.status === 'canceled') loadReason() } })

    // 무료 증정 메뉴 (best-effort — 컬럼 없거나 없으면 무시)
    supabase.from('orders').select('free_gifts').eq('id', orderId).single()
      .then(({ data, error }) => { if (!error && Array.isArray((data as any)?.free_gifts)) setGifts((data as any).free_gifts) })

    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [orderId])

  useEffect(() => {
    if (prevStatus.current === null) { prevStatus.current = status; return }
    if (prevStatus.current === status) return
    const prev = prevStatus.current
    prevStatus.current = status

    if (status === 'accepted') {
      try {
        const ctx = new AudioContext()
        ;[880, 1100].forEach((freq, i) => {
          const osc = ctx.createOscillator(); const g = ctx.createGain()
          osc.connect(g); g.connect(ctx.destination)
          osc.frequency.value = freq
          g.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.25)
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.2)
          osc.start(ctx.currentTime + i * 0.25); osc.stop(ctx.currentTime + i * 0.25 + 0.25)
        })
      } catch {}
      try {
        const u = new SpeechSynthesisUtterance('주문이 확인됐어요. 곧 조리 시작합니다')
        u.lang = 'ko-KR'; u.volume = 1; u.rate = 0.9
        window.speechSynthesis.speak(u)
      } catch {}
    } else if (status === 'cooking') {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator(); const g = ctx.createGain()
        osc.connect(g); g.connect(ctx.destination)
        osc.frequency.value = 660
        g.gain.setValueAtTime(0.1, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
        osc.start(); osc.stop(ctx.currentTime + 0.35)
      } catch {}
      try {
        const u = new SpeechSynthesisUtterance('맛있게 조리 중이에요. 조금만 기다려주세요')
        u.lang = 'ko-KR'; u.volume = 1; u.rate = 0.9
        window.speechSynthesis.speak(u)
      } catch {}
    } else if (status === 'done') {
      try {
        const ctx = new AudioContext()
        ;[523, 659, 784].forEach((freq, i) => {
          const osc = ctx.createOscillator(); const g = ctx.createGain()
          osc.connect(g); g.connect(ctx.destination)
          osc.frequency.value = freq
          g.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.2)
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.18)
          osc.start(ctx.currentTime + i * 0.2); osc.stop(ctx.currentTime + i * 0.2 + 0.2)
        })
      } catch {}
      try {
        const u = new SpeechSynthesisUtterance('주문하신 메뉴가 나왔어요. 맛있게 드세요')
        u.lang = 'ko-KR'; u.volume = 1; u.rate = 0.9
        window.speechSynthesis.speak(u)
      } catch {}
    }
  }, [status])

  // A2: 결제완료(served) 되면 이 테이블 세션의 1차~현재 누적 주문내역과 총액을 불러온다.
  useEffect(() => {
    if (status !== 'served' || !orderId || session) return
    let alive = true
    ;(async () => {
      const agg = (rows: any[]) => {
        const itemMap = new Map<string, number>()
        const giftMap = new Map<string, number>()
        let total = 0
        for (const r of rows) {
          total += r.final_amount || 0
          for (const it of (r.order_items || [])) itemMap.set(it.name_snapshot, (itemMap.get(it.name_snapshot) || 0) + it.qty)
          if (Array.isArray(r.free_gifts)) for (const g of r.free_gifts) giftMap.set(g.menu, (giftMap.get(g.menu) || 0) + (g.qty || 1))
        }
        return {
          items: Array.from(itemMap.entries()).map(([name, qty]) => ({ name, qty })),
          gifts: Array.from(giftMap.entries()).map(([name, qty]) => ({ name, qty })),
          total, orderCount: rows.length,
        }
      }
      // 같은 테이블·같은 결제세션(closed_at) 주문 전체 (마이그레이션 전이면 이 주문 단건으로 폴백)
      try {
        const self = await supabase.from('orders')
          .select('table_no, order_type, closed_at, final_amount, free_gifts, order_items(name_snapshot, qty)')
          .eq('id', orderId).single()
        if (self.error || !self.data) throw self.error || new Error('no self')
        const s: any = self.data
        if (s.closed_at && s.order_type === 'dine_in') {
          const sib = await supabase.from('orders')
            .select('final_amount, free_gifts, order_items(name_snapshot, qty)')
            .eq('table_no', s.table_no).eq('closed_at', s.closed_at)
          if (!sib.error && sib.data?.length) { if (alive) setSession(agg(sib.data)); return }
        }
        if (alive) setSession(agg([s]))
      } catch {
        const one = await supabase.from('orders')
          .select('final_amount, free_gifts, order_items(name_snapshot, qty)')
          .eq('id', orderId).single()
        if (!one.error && one.data && alive) setSession(agg([one.data]))
      }
    })()
    return () => { alive = false }
  }, [status, orderId, session])

  const currentStepIdx = STEPS.findIndex(s => s.key.includes(status))

  const stepState = (idx: number): 'done' | 'active' | 'waiting' => {
    if (idx < currentStepIdx) return 'done'
    if (idx === currentStepIdx) return 'active'
    return 'waiting'
  }

  if (status === 'canceled') return (
    <main>
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😢</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>주문이 취소됐어요</div>
        {cancelReason && (
          <div style={{ display: 'inline-block', background: '#2a1a1a', border: '1px solid #6a3a34', borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#f0d890', marginBottom: 14 }}>
            사유: <b>{cancelReason}</b>
          </div>
        )}
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24 }}>
          불편을 드려 죄송합니다.<br />직원에게 문의해주세요.
        </p>
        <button className="btn-primary" onClick={() => router.push(`/store/${storeId}/menu`)}>
          다시 주문하기
        </button>
      </div>
      <LegalFooter />
    </main>
  )

  // A2: 결제완료(세션 마감) — 1차부터 누적된 전체 주문내역 + 총액
  if (status === 'served') return (
    <main>
      <div className="top-bar"><span className="logo">🍗 또봉이통닭</span></div>
      <div className="status-page">
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🧾</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>이용해주셔서 감사합니다!</h2>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>오늘 주문하신 전체 내역이에요</p>
        </div>
        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: '16px', marginTop: 12 }}>
          {session ? (
            <>
              {session.orderCount > 1 && (
                <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>주문 {session.orderCount}건 합산</div>
              )}
              {session.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '6px 0', color: '#eee' }}>
                  <span>{it.name}</span><span style={{ color: '#aaa' }}>× {it.qty}</span>
                </div>
              ))}
              {session.gifts.map((g, i) => (
                <div key={`g${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '6px 0', color: '#3ac47d', fontWeight: 700 }}>
                  <span>🎁 {g.name}{g.qty > 1 ? ` × ${g.qty}` : ''}</span><span>무료</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #333', marginTop: 10, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#ccc' }}>총 결제금액</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#FFD700' }}>{session.total.toLocaleString()}원</span>
              </div>
            </>
          ) : (
            <div style={{ color: '#888', fontSize: 14, textAlign: 'center', padding: 12 }}>내역 불러오는 중…</div>
          )}
        </div>
        <button className="btn-primary" style={{ marginTop: 24 }} onClick={() => router.push(`/store/${storeId}/menu`)}>
          다시 주문하기
        </button>
      </div>
      <LegalFooter />
    </main>
  )

  return (
    <main>
      <div className="top-bar">
        <span className="logo">🍗 또봉이통닭</span>
      </div>
      <div className="status-page">
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>
          {status === 'done' ? '🎉 나왔어요!' : '주문이 접수됐어요'}
        </h2>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>
          {isCash ? '카운터에서 결제 후 기다려주세요' : '잠시만 기다려주세요'}
        </p>

        {/* 무료 증정 안내 — 쿠폰 메뉴가 주문과 함께 나감 */}
        {gifts.length > 0 && (
          <div style={{ margin: '14px 0 0', background: 'linear-gradient(135deg, rgba(58,196,125,0.16), rgba(200,169,0,0.08))', border: '2px solid #3ac47d', borderRadius: 12, padding: '12px 14px', textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#8ef0b8', marginBottom: 3 }}>🎁 무료 증정도 함께 준비돼요!</div>
            {gifts.map((g, i) => (
              <div key={i} style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>· {g.menu}{g.qty > 1 ? ` ${g.qty}개` : ''}</div>
            ))}
            <div style={{ fontSize: 12, color: '#bfe6cc', marginTop: 4 }}>주문 메뉴와 함께 카운터에서 받으세요 😊</div>
          </div>
        )}

        {/* 프로그레스 스텝 (루나 제안) */}
        <div className="status-progress">
          {STEPS.map((step, i) => {
            const st = stepState(i)
            return (
              <div key={i} className={`status-step ${st}`}>
                <div className="step-icon">{step.icon}</div>
                <div className="step-label">
                  <strong>{step.label}</strong>
                  {st === 'active' && <p>{step.desc}</p>}
                </div>
              </div>
            )
          })}
        </div>

        {/* 포춘쿠키 */}
        {status !== 'done' && (
          <div style={{
            background:'#1a1200', border:'1px solid #7a6400',
            borderRadius:12, padding:'20px', marginTop:24, textAlign:'center'
          }}>
            <div style={{fontSize:13, color:'#888', marginBottom:10}}>🔮 오늘의 또봉이 운세</div>
            <div style={{fontSize:17, fontWeight:700, color:'#FFD700', lineHeight:1.7}}>
              {fortune}
            </div>
          </div>
        )}

        {/* 영수증 문자 발송 */}
        {orderId && (
          <div style={{
            marginTop: 24,
            background: '#1a1a1a', border: '1px solid #333',
            borderRadius: 12, padding: '18px 16px',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ccc', marginBottom: 12 }}>
              📄 영수증을 문자로 받으시겠습니까?
            </div>

            {receiptSent ? (
              <div style={{ fontSize: 14, color: '#4caf50', fontWeight: 600 }}>
                ✅ 영수증이 발송됐어요!
              </div>
            ) : memberPhone ? (
              /* 회원: 자동 발송 */
              <div>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
                  등록 번호 {memberPhone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')} 로 발송됩니다
                </div>
                <button
                  onClick={() => sendReceipt(memberPhone)}
                  disabled={receiptLoading}
                  style={{
                    background: '#c8a900', color: '#111',
                    border: 'none', borderRadius: 8,
                    padding: '10px 20px', fontSize: 14, fontWeight: 700,
                    cursor: receiptLoading ? 'not-allowed' : 'pointer',
                    opacity: receiptLoading ? 0.6 : 1,
                  }}
                >
                  {receiptLoading ? '발송 중…' : '영수증 받기'}
                </button>
              </div>
            ) : showReceiptInput ? (
              /* 비회원: 번호 입력 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="tel"
                  placeholder="전화번호 입력 (예: 01012345678)"
                  value={receiptPhone}
                  onChange={e => setReceiptPhone(e.target.value)}
                  style={{
                    background: '#111', border: '1px solid #444', borderRadius: 8,
                    padding: '10px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none',
                  }}
                />
                <button
                  onClick={() => sendReceipt(receiptPhone)}
                  disabled={receiptLoading || receiptPhone.length < 10}
                  style={{
                    background: '#c8a900', color: '#111',
                    border: 'none', borderRadius: 8,
                    padding: '10px', fontSize: 14, fontWeight: 700,
                    cursor: (receiptLoading || receiptPhone.length < 10) ? 'not-allowed' : 'pointer',
                    opacity: (receiptLoading || receiptPhone.length < 10) ? 0.6 : 1,
                  }}
                >
                  {receiptLoading ? '발송 중…' : '영수증 발송'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowReceiptInput(true)}
                style={{
                  background: 'none', border: '1px solid #555', borderRadius: 8,
                  padding: '10px 20px', color: '#aaa', fontSize: 14, cursor: 'pointer',
                }}
              >
                전화번호 입력해서 받기
              </button>
            )}

            {receiptError && (
              <div style={{ fontSize: 13, color: '#f44', marginTop: 8 }}>{receiptError}</div>
            )}
          </div>
        )}

        {/* 완료 시 추가 주문 버튼 */}
        {status === 'done' && (
          <div style={{ marginTop: 32 }}>
            <button className="btn-primary" onClick={() => router.push(`/store/${storeId}/menu`)}>
              추가 주문하기
            </button>
            {/* v1.4: PWA 설치 유도 문구 비활성화 (PWAPrompt.tsx 참조 — 구조 보존)
            {showInstallTip && (
              <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#888', lineHeight: 1.6 }}>
                📲 다음 방문엔 더 빠르게! 홈 화면에 추가해 두세요 😊
              </div>
            )}
            */}
          </div>
        )}
      </div>
      <LegalFooter />
    </main>
  )
}

export default function OrderStatusPage() {
  return <Suspense><StatusContent /></Suspense>
}
