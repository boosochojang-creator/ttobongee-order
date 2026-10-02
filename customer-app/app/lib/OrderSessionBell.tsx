'use client'
// [그룹5·주문누적] 결제 전 '이번 방문'의 진행 주문(회차)을 누적으로 보여주는 전역 '종'.
//   - 어느 화면에서든 하단에 종+누적금액 노출, 탭하면 회차별 주문내역 펼침.
//   - 점주가 결제처리(정산)하면 서버에서 해당 주문이 served로 바뀌고, 실시간/폴링으로 감지해 종이 사라진다.
//   - 회원 본인(user_id) 기준이라 테이블번호 잔존/오인식과 무관하게 '내 주문'만 정확히 누적.
import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useCart } from './cartStore'
import { supabase } from './supabase'
import { useStoreId } from './storeContext'
import { tableLabel } from './tableLabel'

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
  const { userId, isMember, tableNo, orderType, hydrated, setTableNo, setOrderType } = useCart()
  const pathname = usePathname()
  const storeId = useStoreId()
  const [rounds, setRounds] = useState<Round[]>([])
  const [leaveAsk, setLeaveAsk] = useState(false) // [2026-10] 뒤로가기로 창 닫힘 방지 확인창
  const restoredRef = useRef(false)
  const leavingRef = useRef(false)
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

  // [2026-10 ①] 창이 닫혔다 다시 열려도(뒤로가기·탭 정리·앱 재실행) 결제 전이면 테이블을 자동 복원 → QR 재스캔 불필요.
  //   평소엔 테이블번호를 재실행 간에 기억하지 않지만(테이블 잔존 버그 방지), '결제 안 된 내 주문이 실제로 있을 때'만
  //   그 주문의 테이블로 되돌린다. 자리선택·입구 화면에선 손님이 직접 고르는 중이라 건드리지 않는다.
  useEffect(() => {
    if (restoredRef.current || !hydrated || !isMember || !userId) return
    if (Number.isInteger(tableNum) && tableNum > 0) { restoredRef.current = true; return }
    if (!pathname?.startsWith('/store/') || pathname.endsWith('/table') || pathname.endsWith('/entry')) return
    restoredRef.current = true
    fetch(`/api/order/session?userId=${userId}&storeId=${storeId}`, { cache: 'no-store' }).then(x => x.json()).then(r => {
      const list: any[] = r?.ok ? (r.rounds || []) : []
      const last = [...list].reverse().find(o => (o.tableNo || 0) > 0)
      if (last) { setTableNo(String(last.tableNo)); setOrderType('dine_in') }
    }).catch(() => {})
  }, [hydrated, isMember, userId, tableNum, pathname, storeId, setTableNo, setOrderType])

  // [2026-10 ②] 결제 전에는 주문화면(메뉴)에서 뒤로가기로 창이 닫히지 않게 — 확인창을 띄워 손님이 직접 결정.
  const guardActive = isMember && !!userId && rounds.length > 0 && pathname === `/store/${storeId}/menu`
  useEffect(() => {
    if (!guardActive) return
    leavingRef.current = false
    // 현재 항목을 한 번 더 쌓아 둔다(Next 라우터 상태를 그대로 복사해 라우터와 충돌 없이).
    const pushGuard = () => { try { window.history.pushState({ ...(window.history.state || {}), __orderGuard: true }, '', window.location.href) } catch {} }
    if (!window.history.state?.__orderGuard) pushGuard()
    const onPop = () => {
      if (leavingRef.current) return
      pushGuard()        // 일단 화면 유지
      setLeaveAsk(true)  // 닫을지 물어봄
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [guardActive])

  const confirmLeave = () => {
    leavingRef.current = true
    setLeaveAsk(false)
    try { window.history.go(-2) } catch {}  // 방금 다시 쌓은 보호 항목 + 원래 화면을 지나 이전으로
  }

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
          <span>{shared ? `${tableLabel(tableNum)} 주문` : '진행 중 주문'} · <b>{won(total)}</b></span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>내역 ▲</span>
        </button>
      )}

      {/* [2026-10] 뒤로가기 시 닫힘 확인창 */}
      {leaveAsk && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: 'min(92vw, 380px)', background: '#1a1a1a', border: '2px solid #c8a900', borderRadius: 18, padding: '24px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 6 }}>🧾</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#FFD700', marginBottom: 10 }}>아직 결제 전이에요</div>
            <div style={{ fontSize: 14.5, color: '#ddd', lineHeight: 1.7, marginBottom: 18 }}>
              창을 닫으면 다음 주문 때<br /><b style={{ color: '#fff' }}>QR을 다시 찍어야 할 수 있어요.</b><br />창을 닫을까요?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setLeaveAsk(false)} style={{ flex: 1, padding: 13, background: 'linear-gradient(150deg,#d6b25a,#bd9a3c 45%,#7a5715)', color: '#111', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 900, cursor: 'pointer' }}>
                취소 (계속 주문)
              </button>
              <button onClick={confirmLeave} style={{ flex: 1, padding: 13, background: '#2a2a2a', color: '#bbb', border: '1px solid #444', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                확인 (닫기)
              </button>
            </div>
          </div>
        </div>
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
