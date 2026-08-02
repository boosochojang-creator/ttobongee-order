'use client'
// [항목6-③] 사장님↔손님 개인 1:1 메시지 — 종뱃지(안읽음) + 대화 시트 + 답장.
//   쿠폰 종뱃지와 통일감. 좌하단(쿠폰 뱃지 위)에 배치. 회원만.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useCart } from './cartStore'
import { useStoreId } from './storeContext'

type Msg = { id: string; sender: 'owner' | 'customer'; body: string; created_at: string; read_at: string | null }
type Ctx = { unread: number; open: () => void }
const MessageContext = createContext<Ctx>({ unread: 0, open: () => {} })

export function MessageProvider({ children }: { children: ReactNode }) {
  const { userId, isMember } = useCart()
  const storeId = useStoreId()
  const [unread, setUnread] = useState(0)
  const [sheet, setSheet] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const scRef = useRef<HTMLDivElement | null>(null)

  const fetchUnread = useCallback(() => {
    if (!userId) { setUnread(0); return }
    fetch(`/api/messages/unread?userId=${userId}&storeId=${storeId}`)
      .then(r => r.json()).then(r => { if (r?.ok) setUnread(r.unread || 0) }).catch(() => {})
  }, [userId, storeId])

  // 안읽음 수: 진입/포커스/30초 폴링
  useEffect(() => { fetchUnread() }, [fetchUnread])
  useEffect(() => {
    const onF = () => fetchUnread()
    window.addEventListener('focus', onF)
    const t = setInterval(fetchUnread, 30000)
    return () => { window.removeEventListener('focus', onF); clearInterval(t) }
  }, [fetchUnread])

  const loadThread = useCallback(() => {
    if (!userId) return
    fetch('/api/messages/thread', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, storeId }) })
      .then(r => r.json()).then(r => { if (r?.ok) { setMsgs(r.messages); setUnread(0) } })
      .catch(() => {})
  }, [userId, storeId])

  const open = useCallback(() => { setSheet(true); loadThread() }, [loadThread])

  useEffect(() => { if (sheet) setTimeout(() => { scRef.current?.scrollTo(0, scRef.current.scrollHeight) }, 50) }, [sheet, msgs])

  const sendReply = async () => {
    const text = reply.trim()
    if (!text || !userId) return
    setBusy(true)
    const r = await fetch('/api/messages/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, storeId, body: text }) })
      .then(x => x.json()).catch(() => null)
    setBusy(false)
    if (r?.ok) { setReply(''); loadThread() }
  }

  const showBadge = isMember && !!userId && unread > 0

  return (
    <MessageContext.Provider value={{ unread, open }}>
      {children}

      {/* 종뱃지 — 좌하단(쿠폰 뱃지 위) */}
      {showBadge && (
        <button onClick={open} aria-label="사장님 메시지"
          style={{
            position: 'fixed', bottom: 150, left: 16, zIndex: 201,
            width: 56, height: 56, borderRadius: '50%', background: '#1c1c1c', border: '1.5px solid #7fd4ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
          💬
          <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, padding: '0 5px', background: '#e84040', color: '#fff', fontSize: 12, fontWeight: 800, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>
        </button>
      )}

      {/* 대화 시트 */}
      {sheet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 320, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setSheet(false)}>
          <div style={{ background: '#1c1c1c', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>💬 사장님과 대화</span>
              <button onClick={() => setSheet(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div ref={scRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {msgs.length === 0 && <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: 20 }}>아직 주고받은 메시지가 없어요.</div>}
              {msgs.map(m => (
                <div key={m.id} style={{ alignSelf: m.sender === 'owner' ? 'flex-start' : 'flex-end', maxWidth: '80%' }}>
                  <div style={{
                    background: m.sender === 'owner' ? '#243' : '#2b7fc0', color: '#f0f0f0',
                    borderRadius: 14, padding: '9px 13px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                  }}>{m.body}</div>
                  <div style={{ fontSize: 10, color: '#666', marginTop: 2, textAlign: m.sender === 'owner' ? 'left' : 'right' }}>
                    {m.sender === 'owner' ? '사장님' : '나'} · {new Date(m.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 12px', borderTop: '1px solid #2a2a2a', display: 'flex', gap: 8 }}>
              <input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendReply()}
                placeholder="답장을 입력하세요" maxLength={500}
                style={{ flex: 1, background: '#111', border: '1px solid #333', borderRadius: 10, padding: '10px 12px', color: '#eee', fontSize: 14, outline: 'none' }} />
              <button onClick={sendReply} disabled={busy || !reply.trim()}
                style={{ padding: '10px 16px', background: busy || !reply.trim() ? '#333' : '#2b7fc0', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 10, cursor: 'pointer' }}>보내기</button>
            </div>
          </div>
        </div>
      )}
    </MessageContext.Provider>
  )
}

export function useMessages() {
  return useContext(MessageContext)
}
