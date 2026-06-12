'use client'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import LegalFooter from '../../../lib/LegalFooter'

type Status = 'pending' | 'paid' | 'cash_pending' | 'accepted' | 'cooking' | 'done' | 'canceled'

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
  const router = useRouter()
  const orderId = params.get('id')
  const isCash = params.get('cash') === '1'
  const memberPhone = params.get('phone') ?? ''
  const [status, setStatus] = useState<Status>('pending')
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
      })
      .subscribe()

    // 폴링 백업 (아렌: 누락 복구)
    const poll = setInterval(async () => {
      const { data } = await supabase.from('orders').select('status').eq('id', orderId).single()
      if (data) setStatus(data.status as Status)
    }, 8000)

    // 초기 조회
    supabase.from('orders').select('status').eq('id', orderId).single()
      .then(({ data }) => { if (data) setStatus(data.status as Status) })

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
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24 }}>
          불편을 드려 죄송합니다.<br />직원에게 문의해주세요.
        </p>
        <button className="btn-primary" onClick={() => router.push('/store/baegun/menu')}>
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
            <button className="btn-primary" onClick={() => router.push('/store/baegun/menu')}>
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
