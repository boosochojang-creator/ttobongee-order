'use client'
// [어울장] PIN 화면 아래 '어울장 운영자로 입장' — 매장 PIN과 관계없이 운영자 비밀번호로 이 매장 점주 화면에 들어간다.
import { useState } from 'react'

export default function OperatorLogin({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const enter = async () => {
    const r = await fetch('/api/verify-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, operator: true }) })
      .then(x => x.json()).catch(() => null)
    if (r?.ok) onSuccess()
    else { setErr(r?.error || '입장하지 못했어요'); setPin('') }
  }
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ marginTop: 18, background: 'none', border: 'none', color: '#777', fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer' }}>
      어울장 운영자로 입장
    </button>
  )
  return (
    <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, borderTop: '1px solid #333', paddingTop: 14, width: '100%', maxWidth: 260 }}>
      <span style={{ fontSize: 13, color: '#f3e2b0', fontWeight: 700 }}>📱 어울장 운영자 비밀번호</span>
      <input type="password" inputMode="numeric" maxLength={8} value={pin} autoFocus placeholder="숫자 6~8자리"
        onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setErr('') }} onKeyDown={e => e.key === 'Enter' && enter()}
        style={{ width: '100%', textAlign: 'center', fontSize: 18, padding: '10px', borderRadius: 10, border: '1px solid #444', background: '#1a1a1a', color: '#eee' }} />
      {err && <span style={{ color: '#e84040', fontSize: 12.5 }}>{err}</span>}
      <button onClick={enter} style={{ width: '100%', padding: '10px', borderRadius: 10, fontWeight: 800, background: '#c8a900', color: '#1a1208', border: 'none', cursor: 'pointer' }}>운영자로 입장</button>
    </div>
  )
}
