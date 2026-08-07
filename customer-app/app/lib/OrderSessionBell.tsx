'use client'
// [그룹5·주문누적] 결제 전 '이번 방문'의 진행 주문(회차)을 누적으로 보여주는 전역 '종'.
//   - 어느 화면에서든 하단에 종+누적금액 노출, 탭하면 회차별 주문내역 펼침.
//   - 점주가 결제처리(정산)하면 서버에서 해당 주문이 served로 바뀌고, 실시간/폴링으로 감지해 종이 사라진다.
//   - 회원 본인(user_id) 기준이라 테이블번호 잔존/오인식과 무관하게 '내 주문'만 정확히 누적.
import { useEffect, useRef, useState, useCallback } from 'react'
import { useCart } from './cartStore'
import { supabase } from './supabase'

type Round = {
  id: string; round: number; status: string; orderType: string; tableNo: number
  amount: number; items: { name: string; qty: number }[]; gifts: { name: string; qty: number }[]
}

const STATUS_LABEL: Record<string, string> = {
  pending: '주문 확인 중', paid: '주문 확인 중', cash_pending: '주문 확인 중',
  accepted: '접수됨', cooking: '조리 중', done: '조리 완료',
}
const won = (n: number) => n.toLocaleString() + '원'

export default function OrderSessionBell() {
  const { userId, isMember, tableNo, orderType } = useCart()
  const [rounds, setRounds] = useState<Round[]>([])
  const [total, setTotal] = useState(0)
  const [open, setOpen] = useState(false)
  // dine_in 착석(유효 테이블)이면 '테이블 공유 탭', 아니면 내(user) 주문 기준
  const tableNum = parseInt(String(tableNo ?? ''), 10)
  const shared = orderType === 'dine_in' && Number.isInteger(tableNum) && tableNum > 0
  const ctxRef = useRef({ userId, shared, tableNum })
  ctxRef.current = { userId, shared, tableNum }

  const load = useCallback(async () => {
    const { userId: uid, shared: sh, tableNum: tn } = ctxRef.current
    if (!uid) { setRounds([]); setTotal(0); return }
    try {
      const url = sh ? `/api/order/session?tableNo=${tn}` : `/api/order/session?userId=${uid}`
      const r = await fetch(url, { cache: 'no-store' }).then(x => x.json())
      if (r?.ok) { setRounds(r.rounds || []); setTotal(r.total || 0); if (!r.rounds?.length) setOpen(false) }
    } catch {}
  }, [])

  useEffect(() => {
    if (!isMember || !userId) { setRounds([]); setTotal(0); setOpen(false); return }
    load()
    // 실시간 갱신(정산되면 사라지도록) + 폴링 백업. 공유 탭이면 테이블 단위, 아니면 내 주문 단위로 구독.
    const filter = shared ? `table_no=eq.${tableNum}` : `user_id=eq.${userId}`
    const ch = supabase.channel(`session-${shared ? `t${tableNum}` : userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter }, () => load())
      .subscribe()
    const poll = setInterval(load, 12000)
    return () => { supabase.removeChannel(ch); clearInterval(poll) }
  }, [isMember, userId, shared, tableNum, load])

  if (!isMember || !userId || rounds.length === 0) return null

  return (
    <>
      {/* 접힌 종 — 하단 중앙 필 */}
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="진행 중인 주문 보기"
          style={{
            position: 'fixed', bottom: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 250,
            display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderRadius: 999,
            background: 'linear-gradient(135deg, #c8a900, #e0c040)', color: '#111', border: 'none',
            fontWeight: 800, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
            maxWidth: 'calc(100vw - 32px)', whiteSpace: 'nowrap',
          }}>
          <span style={{ fontSize: 18, position: 'relative' }}>
            🔔
            <span style={{ position: 'absolute', top: -6, right: -8, background: '#e04a3a', color: '#fff', fontSize: 11, fontWeight: 800, minWidth: 17, height: 17, lineHeight: '17px', borderRadius: 9, padding: '0 4px', textAlign: 'center' }}>{rounds.length}</span>
          </span>
          <span>{shared ? '이 테이블 주문' : '진행 중 주문'} · <b>{won(total)}</b></span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>내역 ▲</span>
        </button>
      )}

      {/* 펼친 시트 */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 320, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#161616', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480,
            maxHeight: '80vh', overflowY: 'auto', borderTop: '2px solid #c8a900', padding: '20px 18px 28px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#FFD700' }}>🔔 {shared ? '이 테이블 진행 중 주문' : '진행 중인 주문'}</div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 12.5, color: '#999', marginBottom: 14, lineHeight: 1.6 }}>
              {shared
                ? '아직 결제 전이에요. 일행이 주문해도 이 테이블 내역에 함께 쌓여요. 카운터에서 한 번에 결제하시면 자동으로 정리됩니다.'
                : '아직 결제 전이에요. 추가로 주문하면 여기에 회차별로 쌓여요. 카운터에서 한 번에 결제하시면 자동으로 정리됩니다.'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rounds.map(r => (
                <div key={r.id} style={{ background: '#1e1e1e', border: '1px solid #333', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: '#f0f0f0' }}>
                      {r.round}회차
                      <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700, color: '#111', background: '#c8a900', borderRadius: 20, padding: '2px 8px' }}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#FFD700' }}>{won(r.amount)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {r.items.map((it, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#ccc' }}>
                        <span>{it.name}</span><span style={{ color: '#888' }}>×{it.qty}</span>
                      </div>
                    ))}
                    {r.gifts.map((g, i) => (
                      <div key={`g${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#8ecfa5' }}>
                        <span>🎁 {g.name} (증정)</span><span>×{g.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px dashed #444' }}>
              <span style={{ fontSize: 14, color: '#ccc', fontWeight: 700 }}>누적 합계 ({rounds.length}회차)</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#FFD700' }}>{won(total)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
