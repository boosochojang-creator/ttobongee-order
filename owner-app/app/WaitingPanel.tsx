'use client'
// [1] 점주 '⏳ 웨이팅' 탭 — 어울장·또봉이 점주앱 공용(같은 파일).
//  · 웨이팅 받기 켜기/끄기 · 입구용 QR(인쇄해서 붙이기)
//  · 대기 목록: [호출](손님 휴대폰 알림·화면 소리) [입장] [부재] [취소] · 호출한 팀은 [다시 호출] [대기로]
//  · 5초마다 새로고침, 새 웨이팅이 들어오면 '띵동' + 음성
import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

type Row = { id: string; number: number; party_size: number; name: string | null; status: string; created_at: string; called_at: string | null; canNotify: boolean }
type Data = { storeId: string; on: boolean; list: Row[]; waiting: number; called: number; seated: number }

const CUSTOMER_BASE = process.env.NEXT_PUBLIC_CUSTOMER_URL || 'https://market-pickup-customer.vercel.app'
const mins = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
function ding() {
  try {
    const ctx = new AudioContext()
    ;[988, 784].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination)
      g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.35); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.33)
      o.start(ctx.currentTime + i * 0.35); o.stop(ctx.currentTime + i * 0.35 + 0.34)
    })
  } catch {}
}

export default function WaitingPanel({ onAuthLost }: { onAuthLost?: () => void }) {
  const [d, setD] = useState<Data | null>(null)
  const [qr, setQr] = useState('')
  const [showQr, setShowQr] = useState(false)
  const [msg, setMsg] = useState('')
  const lastMax = useRef<number | null>(null)

  const load = useCallback(async () => {
    const r = await fetch('/api/waiting', { cache: 'no-store' }).catch(() => null)
    if (!r) return
    if (r.status === 401) { onAuthLost?.(); return }
    const j = await r.json().catch(() => null)
    if (!j?.ok) return
    const max = Math.max(0, ...j.list.map((x: Row) => x.number))
    if (lastMax.current !== null && max > lastMax.current) {
      ding()
      try { const u = new SpeechSynthesisUtterance(`웨이팅 ${max}번 등록`); u.lang = 'ko-KR'; window.speechSynthesis.speak(u) } catch {}
    }
    lastMax.current = max
    setD(j)
  }, [onAuthLost])
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [load])
  useEffect(() => { if (d?.storeId) QRCode.toDataURL(`${CUSTOMER_BASE}/store/${d.storeId}/waiting`, { margin: 1, width: 360 }).then(setQr).catch(() => {}) }, [d?.storeId])

  const act = async (body: Record<string, any>) => {
    const r = await fetch('/api/waiting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.status === 401) { onAuthLost?.(); return }
    const j = await r.json().catch(() => null)
    if (body.action === 'call' && j?.ok) setMsg(j.pushed ? '📲 손님 휴대폰으로 알림을 보냈어요' : '손님 화면에 호출이 떠요(휴대폰 알림은 손님이 켜지 않았어요)')
    else if (!j?.ok) setMsg(j?.error || '처리하지 못했어요')
    setTimeout(() => setMsg(''), 3500)
    load()
  }

  if (!d) return <div style={{ padding: 20, color: '#888' }}>불러오는 중…</div>
  const active = d.list.filter(r => r.status === 'waiting' || r.status === 'called')
  const done = d.list.filter(r => r.status !== 'waiting' && r.status !== 'called').slice(-12).reverse()
  const btn = (bg: string, fg = '#fff'): React.CSSProperties => ({ padding: '10px 12px', borderRadius: 9, border: 'none', background: bg, color: fg, fontWeight: 800, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' })
  const label: Record<string, string> = { seated: '입장', noshow: '부재', canceled: '취소' }

  return (
    <div style={{ padding: 16, maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <section style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 14 }}>
        <button onClick={() => act({ action: 'toggle', on: !d.on })} aria-pressed={d.on}
          style={{ ...btn(d.on ? '#1f6b45' : '#444'), fontSize: 15, padding: '12px 16px' }}>{d.on ? '⏳ 웨이팅 받는 중 (끄기)' : '웨이팅 받기 시작'}</button>
        <div style={{ fontSize: 15, color: '#ddd' }}>대기 <b style={{ color: '#ffd76a', fontSize: 20 }}>{d.waiting}</b>팀 · 호출 {d.called} · 오늘 입장 {d.seated}</div>
        <button onClick={() => setShowQr(s => !s)} style={{ ...btn('#242424', '#ccc'), marginLeft: 'auto' }}>🔳 입구 QR</button>
      </section>
      {showQr && qr && (
        <section style={{ background: '#fff', color: '#111', borderRadius: 12, padding: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <img src={qr} alt="웨이팅 QR" style={{ width: 180, height: 180 }} />
          <div style={{ fontSize: 15, lineHeight: 1.7 }}>
            <b style={{ fontSize: 20 }}>⏳ 줄서기(웨이팅)</b><br />휴대폰 카메라로 찍고<br />인원·이름만 넣으면 차례가 되면 알려드려요<br />
            <span style={{ fontSize: 12, color: '#666', wordBreak: 'break-all' }}>{CUSTOMER_BASE}/store/{d.storeId}/waiting</span>
          </div>
        </section>
      )}
      {msg && <div style={{ fontSize: 14, color: '#9fd8a8' }}>{msg}</div>}
      {!d.on && active.length === 0 && <div style={{ color: '#888', fontSize: 14 }}>웨이팅을 받으려면 위의 [웨이팅 받기 시작]을 누르고, 입구에 QR을 붙여 주세요.</div>}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {active.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: r.status === 'called' ? '#20301f' : '#1c1c1c', border: `1.5px solid ${r.status === 'called' ? '#3ac47d' : '#333'}`, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#ffd76a', minWidth: 58 }}>{r.number}<span style={{ fontSize: 13, color: '#999' }}>번</span></div>
            <div style={{ flex: 1, minWidth: 140, fontSize: 15, lineHeight: 1.5 }}>
              <b>{r.name || '손님'}</b> · {r.party_size}명
              <div style={{ fontSize: 12.5, color: '#999' }}>
                {r.status === 'called' ? `🔔 호출 ${mins(r.called_at!)}분 전` : `기다린 지 ${mins(r.created_at)}분`}{r.canNotify ? ' · 📲 알림 켜짐' : ''}
              </div>
            </div>
            {r.status === 'waiting'
              ? <button style={btn('#c8a900', '#1a1208')} onClick={() => act({ action: 'call', id: r.id })}>🔔 호출</button>
              : <><button style={btn('#c8a900', '#1a1208')} onClick={() => act({ action: 'call', id: r.id })}>다시 호출</button><button style={btn('#333', '#ccc')} onClick={() => act({ action: 'back', id: r.id })}>대기로</button></>}
            <button style={btn('#1f6b45')} onClick={() => act({ action: 'seat', id: r.id })}>입장</button>
            <button style={btn('#333', '#ccc')} onClick={() => act({ action: 'noshow', id: r.id })}>부재</button>
            <button style={btn('#3a2020', '#e8a0a0')} onClick={() => act({ action: 'cancel', id: r.id })}>취소</button>
          </div>
        ))}
      </section>
      {done.length > 0 && (
        <section style={{ fontSize: 13, color: '#888', lineHeight: 1.8 }}>
          <div style={{ fontWeight: 700, color: '#aaa' }}>오늘 처리한 웨이팅</div>
          {done.map(r => <span key={r.id} style={{ marginRight: 12 }}>{r.number}번 {r.name || ''}({r.party_size}명) {label[r.status] || r.status}</span>)}
        </section>
      )}
    </div>
  )
}
