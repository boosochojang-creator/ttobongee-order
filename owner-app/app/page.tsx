'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'

type Order = {
  id: string
  user_id: string | null
  table_no: number
  order_type: string
  status: string
  final_amount: number
  payment_method: string
  is_member: boolean
  created_at: string
  items?: { name_snapshot: string; qty: number; subtotal: number }[]
  member_info?: { visit_count: number; grade: string } | null
}

const won = (n: number) => n.toLocaleString() + '원'

function getGrade(visits: number) {
  if (visits >= 10) return 'gold'
  if (visits >= 5) return 'silver'
  return 'bronze'
}

const GRADE_LABEL: Record<string, string> = {
  gold: '🥇 골드', silver: '🥈 실버', bronze: '🥉 브론즈'
}
const GRADE_COLOR: Record<string, string> = {
  gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32'
}

const PAY_LABELS: Record<string, string> = {
  card: '💳 카드', kakao: '💛 카카오', toss: '💙 토스', cash: '💵 현금'
}

const STATUS_LABEL: Record<string, string> = {
  pending: '신규', paid: '신규', cash_pending: '현금대기',
  accepted: '확인완료', cooking: '조리중', done: '완료', canceled: '취소'
}

function timeAgo(dt: string) {
  const diff = Math.floor((Date.now() - new Date(dt).getTime()) / 1000)
  if (diff < 60) return `${diff}초 전`
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  return `${Math.floor(diff / 3600)}시간 전`
}

export default function OwnerDashboard() {
  const [authed, setAuthed] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [menus, setMenus] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [tab, setTab] = useState<'orders' | 'menu' | 'members' | 'sales' | 'business'>('orders')
  const [summary, setSummary] = useState({ count: 0, sales: 0, newMembers: 0 })
  const [hideDone, setHideDone] = useState(false)
  const [callToast, setCallToast] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', price: '' })
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ category: '치킨류', name: '', price: '' })
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [bizSubTab, setBizSubTab] = useState<'daily' | 'monthly' | 'yearly'>('daily')
  const [todayReport, setTodayReport] = useState<any>(null)
  const [monthlyReports, setMonthlyReports] = useState<any[]>([])
  const [yearlyReports, setYearlyReports] = useState<any[]>([])
  const [closingConfirm, setClosingConfirm] = useState(false)
  const [bizMonth, setBizMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })
  const [bizYear, setBizYear] = useState(new Date().getFullYear())
  const [pinDB, setPinDB] = useState('1234')
  const [pinChangeForm, setPinChangeForm] = useState({ current: '', new1: '', new2: '' })
  const [pinChangeMsg, setPinChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [imgUploading, setImgUploading] = useState(false)
  const [imgMsg, setImgMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null)
  const seenIds = useRef(new Set<string>())
  const audioRef = useRef<AudioContext | null>(null)
  const isFirst = useRef(true)

  const playAlert = useCallback(() => {
    try {
      const ctx = audioRef.current || (audioRef.current = new AudioContext())
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.start(); osc.stop(ctx.currentTime + 0.3)
      setTimeout(() => {
        const o2 = ctx.createOscillator(); const g2 = ctx.createGain()
        o2.connect(g2); g2.connect(ctx.destination)
        o2.frequency.value = 1100
        g2.gain.setValueAtTime(0.1, ctx.currentTime)
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
        o2.start(); o2.stop(ctx.currentTime + 0.25)
      }, 200)
    } catch {}
  }, [])

  function speakOrder(tableNo: number, orderType: string) {
    try {
      const label = orderType === 'takeout' ? '포장' : `${tableNo}번 테이블`
      const u = new SpeechSynthesisUtterance(`${label} 신규 주문입니다`)
      u.lang = 'ko-KR'; u.volume = 1; u.rate = 0.85
      window.speechSynthesis.speak(u)
    } catch {}
  }

  const loadOrders = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('orders')
      .select(`id, user_id, table_no, order_type, status, final_amount, payment_method, is_member, created_at,
               order_items(name_snapshot, qty, subtotal),
               users(visit_count, grade)`)
      .eq('store_id', 'baegun')
      .neq('status', 'canceled')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })

    if (!data) return

    const mapped = data.map((o: any) => ({ ...o, items: o.order_items, member_info: o.users || null }))

    // 새 주문 감지 → 알림음
    if (!isFirst.current) {
      mapped.forEach(o => {
        if (!seenIds.current.has(o.id) && (o.status === 'pending' || o.status === 'cash_pending')) {
          playAlert()
          speakOrder(o.table_no, o.order_type)
          setHideDone(false)
        }
      })
    }
    mapped.forEach(o => seenIds.current.add(o.id))
    isFirst.current = false

    setOrders(mapped)

    // 요약
    const done = mapped.filter(o => ['accepted','cooking','done'].includes(o.status))
    const todayAll = mapped
    setSummary({
      count: todayAll.length,
      sales: todayAll.reduce((s, o) => s + o.final_amount, 0),
      newMembers: 0,
    })
  }, [playAlert])

  const loadMonthlyReports = useCallback(async (year: number, month: number) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const { data } = await supabase.from('daily_reports').select('*')
      .eq('store_id', 'baegun').gte('date', `${year}-${pad(month)}-01`).lte('date', `${year}-${pad(month)}-31`).order('date')
    setMonthlyReports(data || [])
  }, [])

  const loadYearlyReports = useCallback(async (year: number) => {
    const { data } = await supabase.from('daily_reports').select('date, total_sales, order_count')
      .eq('store_id', 'baegun').gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
    setYearlyReports(data || [])
  }, [])

  useEffect(() => {
    if (!authed) return
    loadOrders()
    loadMenus()

    // 아렌: Realtime + 8초 폴링 이중 구조
    const ch = supabase.channel('owner-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadOrders)
      .subscribe()
    const poll = setInterval(loadOrders, 8000)

    const callCh = supabase.channel('customer-calls')
      .on('broadcast', { event: 'call' }, ({ payload }) => {
        const { tableNo, message } = payload
        setCallToast(`🔔 ${tableNo}번 테이블 - ${message}`)
        setTimeout(() => setCallToast(null), 3000)
        playAlert()
        try {
          const u = new SpeechSynthesisUtterance(`${tableNo}번 테이블 ${message}`)
          u.lang = 'ko-KR'; u.volume = 1; u.rate = 0.85
          window.speechSynthesis.speak(u)
        } catch {}
      })
      .subscribe()

    return () => { supabase.removeChannel(ch); supabase.removeChannel(callCh); clearInterval(poll) }
  }, [authed, loadOrders, playAlert])

  useEffect(() => {
    if (!authed || tab !== 'business') return
    loadTodayReport()
  }, [authed, tab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authed || tab !== 'business' || bizSubTab !== 'monthly') return
    loadMonthlyReports(bizMonth.year, bizMonth.month)
  }, [authed, tab, bizSubTab, bizMonth.year, bizMonth.month, loadMonthlyReports])

  useEffect(() => {
    if (!authed || tab !== 'business' || bizSubTab !== 'yearly') return
    loadYearlyReports(bizYear)
  }, [authed, tab, bizSubTab, bizYear, loadYearlyReports])

  useEffect(() => {
    supabase.from('stores').select('pin_code').eq('id', 'baegun').single()
      .then(({ data }) => { if (data?.pin_code) setPinDB(data.pin_code) })
  }, [])

  const loadMenus = async () => {
    const { data } = await supabase.from('menus').select('*').eq('store_id', 'baegun').order('category').order('sort_order')
    if (data) setMenus(data)
  }

  const loadMembers = async () => {
    const { data } = await supabase.from('users').select('phone, visit_count, total_spent, last_visit, grade').eq('store_id', 'baegun').order('visit_count', { ascending: false })
    if (data) setMembers(data)
  }

  const updateStatus = async (orderId: string, status: string) => {
    await fetch('/api/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, status }),
    })
    if (status === 'done') {
      const order = orders.find(o => o.id === orderId)
      if (order?.user_id && order?.is_member) {
        const { data: user } = await supabase.from('users')
          .select('visit_count, total_spent').eq('id', order.user_id).single()
        if (user) {
          const newVisits = (user.visit_count || 0) + 1
          const newSpent = (user.total_spent || 0) + order.final_amount
          await supabase.from('users').update({
            visit_count: newVisits,
            total_spent: newSpent,
            grade: getGrade(newVisits),
            last_visit: new Date().toISOString().slice(0, 10),
          }).eq('id', order.user_id)
        }
      }
    }
    await loadOrders()
  }

  const toggleMenu = async (id: string, cur: boolean) => {
    await fetch('/api/toggle-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_available: cur }),
    })
    await loadMenus()
  }

  const addMenu = async () => {
    if (!addForm.name.trim() || !addForm.price) return
    await supabase.from('menus').insert({
      store_id: 'baegun', category: addForm.category,
      name: addForm.name.trim(), price: parseInt(addForm.price),
      sort_order: 999, is_available: true,
    })
    setAddForm({ category: '치킨류', name: '', price: '' })
    setShowAddForm(false)
    await loadMenus()
  }

  const saveEdit = async () => {
    if (!editingId || !editForm.name.trim() || !editForm.price) return
    await supabase.from('menus').update({ name: editForm.name.trim(), price: parseInt(editForm.price) }).eq('id', editingId)
    setEditingId(null)
    await loadMenus()
  }

  const deleteMenu = async (id: string) => {
    await supabase.from('menus').delete().eq('id', id)
    setDeleteConfirmId(null)
    await loadMenus()
  }

  const loadTodayReport = async () => {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase.from('daily_reports').select('*')
      .eq('store_id', 'baegun').eq('date', today).maybeSingle()
    setTodayReport(data || null)
  }

  const startBusiness = async () => {
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('daily_reports').upsert(
      { store_id: 'baegun', date: today, start_time: new Date().toISOString() },
      { onConflict: 'store_id,date' }
    )
    await loadTodayReport()
  }

  const closeBusiness = async () => {
    const today = new Date().toISOString().slice(0, 10)
    const { data: raw } = await supabase.from('orders')
      .select('final_amount, payment_method').eq('store_id', 'baegun').eq('status', 'done')
      .gte('created_at', `${today}T00:00:00`)
    const list = raw || []
    const total = list.reduce((s: number, o: any) => s + o.final_amount, 0)
    const byM = (m: string) => list.filter((o: any) => o.payment_method === m).reduce((s: number, o: any) => s + o.final_amount, 0)
    const count = list.length
    await supabase.from('daily_reports').upsert({
      store_id: 'baegun', date: today, end_time: new Date().toISOString(),
      total_sales: total, card_sales: byM('card'), cash_sales: byM('cash'),
      kakao_sales: byM('kakao'), toss_sales: byM('toss'),
      order_count: count, avg_order_value: count > 0 ? Math.round(total / count) : 0,
    }, { onConflict: 'store_id,date' })
    setClosingConfirm(false)
    await loadTodayReport()
  }

  const changePIN = async () => {
    setPinChangeMsg(null)
    if (!/^\d{4}$/.test(pinChangeForm.new1)) {
      setPinChangeMsg({ type: 'error', text: '새 PIN은 숫자 4자리여야 해요' })
      return
    }
    if (pinChangeForm.new1 !== pinChangeForm.new2) {
      setPinChangeMsg({ type: 'error', text: '새 PIN 확인이 일치하지 않아요' })
      return
    }
    const res = await fetch('/api/update-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin: pinChangeForm.current, newPin: pinChangeForm.new1 }),
    })
    const data = await res.json()
    if (!data.ok) {
      setPinChangeMsg({ type: 'error', text: data.error || 'PIN 변경에 실패했어요' })
      return
    }
    setPinDB(pinChangeForm.new1)
    setPinChangeForm({ current: '', new1: '', new2: '' })
    setPinChangeMsg({ type: 'success', text: 'PIN이 변경되었습니다' })
  }

  if (!authed) return (
    <div className="pin-screen">
      <div className="brand">🍗 또봉이통닭 점주</div>
      <p style={{ fontSize: 14, color: '#888' }}>PIN 4자리를 입력해주세요</p>
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={e => { setPin(e.target.value); setPinError('') }}
        onKeyDown={e => e.key === 'Enter' && handlePin()}
        placeholder="••••"
        autoFocus
      />
      {pinError && <p style={{ color: '#e84040', fontSize: 13 }}>{pinError}</p>}
      <button className="pin-btn" onClick={handlePin}>입장</button>
    </div>
  )

  function handlePin() {
    if (pin === pinDB) { setAuthed(true) }
    else { setPinError('PIN이 올바르지 않아요'); setPin('') }
  }

  const newOrders = orders.filter(o => ['pending', 'paid', 'cash_pending'].includes(o.status))
  const acceptedOrders = orders.filter(o => o.status === 'accepted')
  const cookingOrders = orders.filter(o => o.status === 'cooking')
  const doneOrders = orders.filter(o => o.status === 'done')

  const OrderCard = ({ order }: { order: Order }) => (
    <div className={`order-card ${order.status === 'pending' || order.status === 'paid' ? 'new-order' : order.status === 'cash_pending' ? 'cash_pending' : order.status === 'accepted' ? 'accepted' : order.status === 'cooking' ? 'cooking' : 'done-card'}`}>
      <div className="order-time">{timeAgo(order.created_at)}</div>
      <div className="order-table">
        {order.order_type === 'takeout' ? '🛍️ 포장' : `${order.table_no}번`}
        <span> {STATUS_LABEL[order.status] || order.status}</span>
      </div>
      <span className={`pay-badge ${order.payment_method}`}>
        {PAY_LABELS[order.payment_method] || order.payment_method}
        {order.is_member && !order.member_info && ' · 단골'}
      </span>
      {order.is_member && order.member_info && (
        <div style={{ fontSize: 12, fontWeight: 700, color: GRADE_COLOR[order.member_info.grade] || '#c8a900', marginTop: 4 }}>
          {GRADE_LABEL[order.member_info.grade]} · {order.member_info.visit_count}번째 방문
        </div>
      )}
      <ul className="order-items-list">
        {order.items?.map((item, i) => (
          <li key={i}><strong>{item.name_snapshot}</strong> × {item.qty}</li>
        ))}
      </ul>
      <div className="order-total">{won(order.final_amount)}</div>
      <div className="action-btns">
        {(order.status === 'pending' || order.status === 'paid' || order.status === 'cash_pending') && (
          <button className="action-btn btn-accept" onClick={() => updateStatus(order.id, 'accepted')}>✅ 접수</button>
        )}
        {order.status === 'accepted' && (
          <button className="action-btn btn-cooking" onClick={() => updateStatus(order.id, 'cooking')}>🍳 조리시작</button>
        )}
        {order.status === 'cooking' && (
          <button className="action-btn btn-done" onClick={() => updateStatus(order.id, 'done')}>🛎️ 완료</button>
        )}
        {order.status !== 'done' && (
          <button className="action-btn btn-cancel" onClick={() => updateStatus(order.id, 'canceled')}>취소</button>
        )}
      </div>
    </div>
  )

  return (
    <div>
      {/* 고객 호출 토스트 */}
      {callToast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 999,
          background: '#c8a900', color: '#111',
          fontSize: 16, fontWeight: 700,
          padding: '12px 20px', borderRadius: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {callToast}
        </div>
      )}

      {/* 헤더 */}
      <div className="owner-header">
        <span className="brand">🍗 또봉이 점주</span>
        <div className="live-badge"><div className="live-dot" />실시간</div>
        {newOrders.length > 0 && (
          <span style={{ marginLeft: 'auto', background: '#e84040', color: '#fff', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>
            신규 {newOrders.length}건
          </span>
        )}
      </div>

      {/* 요약 */}
      <div className="summary-bar">
        <div className="stat-card"><div className="label">오늘 주문</div><div className="value">{summary.count}건</div></div>
        <div className="stat-card"><div className="label">오늘 매출</div><div className="value">{won(summary.sales)}</div></div>
        <div className="stat-card"><div className="label">신규 주문</div><div className="value" style={{ color: newOrders.length ? '#e84040' : 'var(--gold)' }}>{newOrders.length}건</div></div>
        <div className="stat-card"><div className="label">조리중</div><div className="value" style={{ color: '#f09000' }}>{cookingOrders.length}건</div></div>
      </div>

      {/* 탭 */}
      <div className="owner-tabs">
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>주문</button>
        <button className={tab === 'menu' ? 'active' : ''} onClick={() => { setTab('menu'); loadMenus() }}>메뉴</button>
        <button className={tab === 'members' ? 'active' : ''} onClick={() => { setTab('members'); loadMembers() }}>회원</button>
        <button className={tab === 'sales' ? 'active' : ''} onClick={() => setTab('sales')}>매출</button>
        <button className={tab === 'business' ? 'active' : ''} onClick={() => setTab('business')}>영업</button>
      </div>

      {/* 주문 칸반 */}
      {tab === 'orders' && (
        <div className="kanban">
          <div className="kanban-col">
            <h3 style={{ color: '#e84040' }}>🔴 신규 ({newOrders.length})</h3>
            {newOrders.map(o => <OrderCard key={o.id} order={o} />)}
            {!newOrders.length && <div className="empty">신규 주문 없음</div>}
          </div>
          <div className="kanban-col">
            <h3 style={{ color: '#f09000' }}>🟡 조리중 ({cookingOrders.length + acceptedOrders.length})</h3>
            {acceptedOrders.map(o => <OrderCard key={o.id} order={o} />)}
            {cookingOrders.map(o => <OrderCard key={o.id} order={o} />)}
            {!cookingOrders.length && !acceptedOrders.length && <div className="empty">조리 중 없음</div>}
          </div>
          <div className="kanban-col">
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
              <h3 style={{ color: '#3ac47d', margin:0 }}>🟢 완료 ({doneOrders.length})</h3>
              {doneOrders.length > 0 && (
                <button
                  onClick={() => setHideDone(true)}
                  style={{fontSize:12, color:'#666', background:'#242424',
                    border:'1px solid #333', borderRadius:8, padding:'4px 10px', cursor:'pointer'}}
                >
                  화면 정리
                </button>
              )}
            </div>
            {!hideDone && doneOrders.map(o => <OrderCard key={o.id} order={o} />)}
            {!doneOrders.length && <div className="empty">완료 없음</div>}
          </div>
        </div>
      )}

      {/* 메뉴 관리 */}
      {tab === 'menu' && (() => {
        const activeMenus = menus.filter(m => m.is_available !== false)
        const inactiveMenus = menus.filter(m => m.is_available === false)

        const MenuRow = ({ m }: { m: any }) => (
          <div key={m.id} className="menu-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            {editingId === m.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #555', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}
                />
                <input
                  type="number"
                  value={editForm.price}
                  onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                  style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #555', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}
                />
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: imgUploading ? 'not-allowed' : 'pointer',
                  background: '#2a2a2a', border: '1px dashed #555', borderRadius: 8,
                  padding: '10px 12px', fontSize: 13, color: '#aaa',
                  opacity: imgUploading ? 0.6 : 1,
                }}>
                  {m.image_url
                    ? <img src={m.image_url} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} alt="" />
                    : <span style={{ fontSize: 28, flexShrink: 0 }}>🖼</span>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: '#ccc', fontWeight: 600 }}>
                      {imgUploading && imgMsg?.id === String(m.id) ? '업로드 중…' : m.image_url ? '이미지 교체' : '이미지 업로드'}
                    </span>
                    <span style={{ fontSize: 11, color: '#666' }}>
                      {imgMsg?.id === String(m.id)
                        ? <span style={{ color: imgMsg.ok ? '#3ac47d' : '#e84040' }}>{imgMsg.text}</span>
                        : 'JPG / PNG / WEBP'}
                    </span>
                  </div>
                  <input type="file" accept="image/*" style={{ display: 'none' }} disabled={imgUploading} onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return
                    setImgUploading(true); setImgMsg(null)
                    const fd = new FormData(); fd.append('file', file); fd.append('menuId', String(m.id))
                    const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
                    const data = await res.json()
                    setImgUploading(false)
                    setImgMsg({ id: String(m.id), ok: data.ok, text: data.ok ? '✅ 업로드 완료!' : `❌ ${data.error || '실패'}` })
                    if (data.ok) { setTimeout(() => setImgMsg(null), 3000); await loadMenus() }
                  }} />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveEdit} style={{ flex: 1, padding: '8px', background: '#c8a900', color: '#111', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>저장</button>
                  <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: '8px', background: '#2a2a2a', color: '#aaa', border: '1px solid #444', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>취소</button>
                </div>
              </div>
            ) : deleteConfirmId === m.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, color: '#e84040' }}>「{m.name}」 을(를) 삭제할까요?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => deleteMenu(m.id)} style={{ flex: 1, padding: '8px', background: '#e84040', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>삭제</button>
                  <button onClick={() => setDeleteConfirmId(null)} style={{ flex: 1, padding: '8px', background: '#2a2a2a', color: '#aaa', border: '1px solid #444', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>취소</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="menu-row-info">
                  <div className="menu-row-name" style={{ opacity: m.is_available === false ? 0.45 : 1 }}>{m.name}</div>
                  <div className="menu-row-sub">{m.category} · {won(m.price)}</div>
                </div>
                <button onClick={() => { setEditingId(m.id); setEditForm({ name: m.name, price: String(m.price) }) }}
                  style={{ padding: '6px 10px', background: '#2a2a2a', color: '#ccc', border: '1px solid #444', borderRadius: 8, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                  수정
                </button>
                <button onClick={() => setDeleteConfirmId(m.id)}
                  style={{ padding: '6px 10px', background: 'rgba(232,64,64,0.12)', color: '#e84040', border: '1px solid rgba(232,64,64,0.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                  삭제
                </button>
                <button className={`toggle-btn ${m.is_available ? 'on' : 'off'}`} onClick={() => toggleMenu(m.id, m.is_available)}>
                  {m.is_available ? '판매중' : '품절'}
                </button>
              </div>
            )}
          </div>
        )

        return (
          <div className="menu-manage">
            {/* 메뉴 추가 */}
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                style={{
                  width: '100%', padding: '12px',
                  background: showAddForm ? '#2a2a2a' : '#c8a900',
                  color: showAddForm ? '#aaa' : '#111',
                  border: showAddForm ? '1px solid #333' : 'none',
                  borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {showAddForm ? '✕ 취소' : '+ 메뉴 추가'}
              </button>
              {showAddForm && (
                <div style={{ background: '#1c1c1c', border: '1px solid #333', borderRadius: 12, padding: '16px', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <select
                    value={addForm.category}
                    onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                    style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #444', borderRadius: 8, padding: '10px 12px', fontSize: 14 }}
                  >
                    {['세트메뉴', '치킨류', '안주류', '음료/주류'].map(c => <option key={c}>{c}</option>)}
                  </select>
                  <input
                    placeholder="메뉴명"
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                    style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #444', borderRadius: 8, padding: '10px 12px', fontSize: 14 }}
                  />
                  <input
                    placeholder="가격 (숫자만)"
                    type="number"
                    value={addForm.price}
                    onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))}
                    style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #444', borderRadius: 8, padding: '10px 12px', fontSize: 14 }}
                  />
                  <button
                    onClick={addMenu}
                    disabled={!addForm.name.trim() || !addForm.price}
                    style={{
                      padding: '12px', background: '#c8a900', color: '#111',
                      border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
                      cursor: 'pointer', opacity: addForm.name.trim() && addForm.price ? 1 : 0.4,
                    }}
                  >
                    저장
                  </button>
                </div>
              )}
            </div>

            {/* 판매중 메뉴 */}
            {activeMenus.map(m => <MenuRow key={m.id} m={m} />)}

            {/* 품절 메뉴 */}
            {inactiveMenus.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: '#555', padding: '14px 0 6px', borderTop: '1px solid #2a2a2a', marginTop: 4 }}>
                  품절 처리된 메뉴 ({inactiveMenus.length})
                </div>
                {inactiveMenus.map(m => <MenuRow key={m.id} m={m} />)}
              </>
            )}
          </div>
        )
      })()}

      {/* 매출 내역 */}
      {tab === 'sales' && (() => {
        const salesOrders = orders
          .filter(o => o.status === 'done')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const byMethod: Record<string, number> = {}
        salesOrders.forEach(o => {
          byMethod[o.payment_method] = (byMethod[o.payment_method] || 0) + o.final_amount
        })
        const totalSales = salesOrders.reduce((s, o) => s + o.final_amount, 0)
        return (
          <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20,
              background: '#1c1c1c', borderRadius: 12, padding: '14px 16px',
            }}>
              {(['card','kakao','toss','cash'] as const).map(k => byMethod[k] ? (
                <div key={k} style={{ fontSize: 13, color: '#ccc' }}>
                  {PAY_LABELS[k]}: <strong style={{ color: '#fff' }}>{won(byMethod[k])}</strong>
                </div>
              ) : null)}
              <div style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 700, color: '#c8a900' }}>
                합계: {won(totalSales)}
              </div>
            </div>
            {!salesOrders.length && <div className="empty">완료된 주문이 없어요</div>}
            {salesOrders.map(o => (
              <div key={o.id} style={{
                background: '#1c1c1c', borderRadius: 12, marginBottom: 8,
                border: '1px solid #2a2a2a', overflow: 'hidden',
              }}>
                <div
                  onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 12, color: '#888', minWidth: 50 }}>
                    {new Date(o.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ fontSize: 13, color: '#ccc', minWidth: 40 }}>
                    {o.order_type === 'takeout' ? '🛍️포장' : `${o.table_no}번`}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.items?.[0]?.name_snapshot}{o.items && o.items.length > 1 ? ` 외 ${o.items.length - 1}` : ''}
                  </span>
                  <span style={{ fontSize: 12, color: '#888' }}>{PAY_LABELS[o.payment_method] || o.payment_method}</span>
                  <span style={{ fontWeight: 700, color: '#c8a900' }}>{won(o.final_amount)}</span>
                </div>
                {expandedId === o.id && (
                  <div style={{ padding: '0 16px 12px', borderTop: '1px solid #2a2a2a' }}>
                    {o.items?.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#ccc', padding: '4px 0' }}>
                        <span>{item.name_snapshot} × {item.qty}</span>
                        <span>{won(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })()}

      {/* 영업 관리 */}
      {tab === 'business' && (() => {
        const pad2 = (n: number) => String(n).padStart(2, '0')
        const fmtTime = (iso?: string) => iso
          ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          : '-'

        // 오늘 실시간 (orders state 기준)
        const todaySales = orders.filter(o => o.status === 'done')
        const todaySalesTotal = todaySales.reduce((s, o) => s + o.final_amount, 0)
        const todayCount = todaySales.length

        // 이달 바 차트
        const daysInMonth = new Date(bizMonth.year, bizMonth.month, 0).getDate()
        const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
          const d = i + 1
          const dateStr = `${bizMonth.year}-${pad2(bizMonth.month)}-${pad2(d)}`
          const r = monthlyReports.find(r => r.date === dateStr)
          return { day: d, total: r?.total_sales || 0 }
        })
        const maxMonthDay = Math.max(...monthDays.map(d => d.total), 1)
        const monthTotal = monthlyReports.reduce((s, r) => s + r.total_sales, 0)
        const monthCount = monthlyReports.reduce((s, r) => s + r.order_count, 0)

        // 연간 바 차트
        const yearMonths = Array.from({ length: 12 }, (_, i) => {
          const m = i + 1
          const recs = yearlyReports.filter(r => new Date(r.date + 'T12:00:00').getMonth() + 1 === m)
          return { month: m, total: recs.reduce((s, r) => s + r.total_sales, 0), count: recs.reduce((s, r) => s + r.order_count, 0) }
        })
        const maxYearMonth = Math.max(...yearMonths.map(m => m.total), 1)
        const yearTotal = yearlyReports.reduce((s, r) => s + r.total_sales, 0)

        const SB = ({ label, value, gold }: { label: string; value: string; gold?: boolean }) => (
          <div style={{ flex: 1, background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: gold ? '#c8a900' : '#ccc' }}>{value}</div>
          </div>
        )

        const NavBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
          <button onClick={onClick} style={{ background: 'none', border: '1px solid #333', color: '#ccc', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 18 }}>{children}</button>
        )

        return (
          <div style={{ paddingBottom: 40 }}>
            {/* 서브탭 */}
            <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
              {(['daily', 'monthly', 'yearly'] as const).map(t => (
                <button key={t} onClick={() => setBizSubTab(t)} style={{
                  flex: 1, padding: '11px 8px', fontSize: 13, fontWeight: 600,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: bizSubTab === t ? '#c8a900' : '#666',
                  borderBottom: `2px solid ${bizSubTab === t ? '#c8a900' : 'transparent'}`,
                }}>
                  {t === 'daily' ? '오늘' : t === 'monthly' ? '이달' : '연간'}
                </button>
              ))}
            </div>

            {/* ── 오늘 ── */}
            {bizSubTab === 'daily' && (
              <div style={{ padding: 16 }}>
                {/* 영업 상태 카드 */}
                <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 14, padding: 18, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>영업 시작</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: todayReport?.start_time ? '#3ac47d' : '#444' }}>{fmtTime(todayReport?.start_time)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>마감</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: todayReport?.end_time ? '#c8a900' : '#444' }}>{fmtTime(todayReport?.end_time)}</div>
                    </div>
                  </div>
                  {!todayReport?.start_time ? (
                    <button onClick={startBusiness} style={{ width: '100%', padding: 14, background: '#3ac47d', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                      🟢 영업 시작
                    </button>
                  ) : !todayReport?.end_time ? (
                    <button onClick={() => setClosingConfirm(true)} style={{ width: '100%', padding: 14, background: '#c8a900', color: '#111', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                      🛎️ 영업 마감
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ textAlign: 'center', fontSize: 14, color: '#3ac47d', fontWeight: 700 }}>✅ 오늘 영업 마감 완료</div>
                      <button onClick={() => setClosingConfirm(true)} style={{ width: '100%', padding: 11, background: '#2a2a2a', color: '#888', border: '1px solid #333', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
                        재마감 (데이터 갱신)
                      </button>
                    </div>
                  )}
                </div>

                {/* 실시간 현황 */}
                <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 14, padding: 16, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>오늘 실시간 현황 (완료 주문)</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <SB label="총 매출" value={won(todaySalesTotal)} gold />
                    <SB label="주문 수" value={`${todayCount}건`} />
                    <SB label="평균 객단가" value={todayCount > 0 ? won(Math.round(todaySalesTotal / todayCount)) : '-'} />
                  </div>
                </div>

                {/* 마감 데이터 */}
                {todayReport?.end_time && (
                  <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 14, padding: 16 }}>
                    <div style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>마감 집계 데이터</div>
                    {[{ label: '💳 카드', val: todayReport.card_sales }, { label: '💛 카카오', val: todayReport.kakao_sales },
                      { label: '💙 토스', val: todayReport.toss_sales }, { label: '💵 현금', val: todayReport.cash_sales }]
                      .filter(r => r.val > 0).map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#ccc', marginBottom: 6 }}>
                        <span>{r.label}</span><span>{won(r.val)}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#c8a900', marginTop: 4 }}>
                      <span>합계</span><span>{won(todayReport.total_sales)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginTop: 6 }}>
                      <span>주문 {todayReport.order_count}건</span>
                      <span>평균 {won(todayReport.avg_order_value)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── 이달 ── */}
            {bizSubTab === 'monthly' && (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <NavBtn onClick={() => setBizMonth(p => { const d = new Date(p.year, p.month - 2, 1); return { year: d.getFullYear(), month: d.getMonth() + 1 } })}>‹</NavBtn>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{bizMonth.year}년 {bizMonth.month}월</span>
                  <NavBtn onClick={() => setBizMonth(p => { const d = new Date(p.year, p.month, 1); return { year: d.getFullYear(), month: d.getMonth() + 1 } })}>›</NavBtn>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <SB label="월 매출" value={won(monthTotal)} gold />
                  <SB label="주문" value={`${monthCount}건`} />
                  <SB label="영업일" value={`${monthlyReports.length}일`} />
                </div>
                {/* 일별 바 차트 */}
                <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 14, padding: 16, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>일별 매출</div>
                  <div style={{ display: 'flex', height: 72, alignItems: 'flex-end', gap: 1 }}>
                    {monthDays.map(d => (
                      <div key={d.day} style={{ flex: 1, borderRadius: '2px 2px 0 0', minHeight: d.total > 0 ? 3 : 0,
                        height: d.total > 0 ? `${Math.max((d.total / maxMonthDay) * 68, 3)}px` : 0,
                        background: d.total > 0 ? '#c8a900' : 'transparent' }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 1, marginTop: 4 }}>
                    {monthDays.map(d => (
                      <div key={d.day} style={{ flex: 1, textAlign: 'center', fontSize: 7, color: '#444' }}>
                        {d.day === 1 || d.day % 10 === 0 ? d.day : ''}
                      </div>
                    ))}
                  </div>
                  {monthlyReports.length === 0 && <div style={{ textAlign: 'center', color: '#444', fontSize: 13, paddingTop: 8 }}>데이터 없음</div>}
                </div>
                {/* 일별 목록 */}
                {[...monthlyReports].reverse().map(r => (
                  <div key={r.date} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 4px', borderBottom: '1px solid #1e1e1e', fontSize: 14 }}>
                    <span style={{ color: '#888' }}>{r.date.slice(5)}</span>
                    <span style={{ color: '#aaa' }}>{r.order_count}건</span>
                    <span style={{ fontWeight: 700, color: '#c8a900' }}>{won(r.total_sales)}</span>
                  </div>
                ))}
                {monthlyReports.length === 0 && <div style={{ textAlign: 'center', color: '#444', fontSize: 13, paddingTop: 12 }}>이달 영업 기록 없음</div>}
              </div>
            )}

            {/* ── 연간 ── */}
            {bizSubTab === 'yearly' && (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <NavBtn onClick={() => setBizYear(y => y - 1)}>‹</NavBtn>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{bizYear}년</span>
                  <NavBtn onClick={() => setBizYear(y => y + 1)}>›</NavBtn>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <SB label="연간 매출" value={won(yearTotal)} gold />
                  <SB label="총 주문" value={`${yearlyReports.reduce((s, r) => s + r.order_count, 0)}건`} />
                  <SB label="영업일" value={`${yearlyReports.length}일`} />
                </div>
                {/* 월별 바 차트 */}
                <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 14, padding: 16, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>월별 매출</div>
                  <div style={{ display: 'flex', height: 90, alignItems: 'flex-end', gap: 3 }}>
                    {yearMonths.map(m => (
                      <div key={m.month} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: '75%', borderRadius: '3px 3px 0 0', minHeight: m.total > 0 ? 4 : 0,
                          height: m.total > 0 ? `${Math.max((m.total / maxYearMonth) * 86, 4)}px` : 0,
                          background: m.total > 0 ? '#c8a900' : '#1e1e1e' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                    {yearMonths.map(m => (
                      <div key={m.month} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#555' }}>{m.month}</div>
                    ))}
                  </div>
                </div>
                {/* 월별 목록 */}
                {yearMonths.filter(m => m.total > 0).reverse().map(m => (
                  <div key={m.month} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 4px', borderBottom: '1px solid #1e1e1e', fontSize: 14 }}>
                    <span style={{ color: '#888' }}>{m.month}월</span>
                    <span style={{ color: '#aaa' }}>{m.count}건</span>
                    <span style={{ fontWeight: 700, color: '#c8a900' }}>{won(m.total)}</span>
                  </div>
                ))}
                {yearTotal === 0 && <div style={{ textAlign: 'center', color: '#444', fontSize: 13, paddingTop: 12 }}>{bizYear}년 영업 기록 없음</div>}
              </div>
            )}

            {/* BGM 변경 */}
            <div style={{ margin: '16px 16px 0', background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#aaa', marginBottom: 12 }}>🎵 배경음악 변경</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#111', border: '1px dashed #444', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#888' }}>
                MP3 파일 선택
                <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return
                  const fd = new FormData(); fd.append('file', file)
                  const res = await fetch('/api/upload-bgm', { method: 'POST', body: fd })
                  const data = await res.json()
                  if (data.ok) alert('배경음악이 변경되었습니다')
                  else alert('업로드 실패: ' + data.error)
                }} />
              </label>
              <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>업로드 후 고객앱 재진입 시 새 음악이 적용됩니다</div>
            </div>

            {/* PIN 변경 */}
            <div style={{ margin: '16px 16px 0', background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#aaa', marginBottom: 14 }}>🔐 PIN 변경</div>
              {(['current', 'new1', 'new2'] as const).map((key, i) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
                    {i === 0 ? '현재 PIN' : i === 1 ? '새 PIN (숫자 4자리)' : '새 PIN 확인'}
                  </div>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinChangeForm[key]}
                    onChange={e => { setPinChangeForm(p => ({ ...p, [key]: e.target.value })); setPinChangeMsg(null) }}
                    placeholder="••••"
                    style={{
                      width: '100%', padding: '10px 12px', background: '#111',
                      border: '1px solid #333', borderRadius: 8, color: '#fff',
                      fontSize: 18, letterSpacing: 6, boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
              {pinChangeMsg && (
                <div style={{ fontSize: 13, marginBottom: 10, color: pinChangeMsg.type === 'success' ? '#3ac47d' : '#e84040' }}>
                  {pinChangeMsg.type === 'success' ? '✅ ' : '❌ '}{pinChangeMsg.text}
                </div>
              )}
              <button
                onClick={changePIN}
                style={{ width: '100%', padding: 13, background: '#c8a900', color: '#111', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                PIN 변경하기
              </button>
            </div>

            {/* 마감 확인 팝업 */}
            {closingConfirm && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div style={{ background: '#1c1c1c', borderRadius: '20px 20px 0 0', padding: '28px 24px 48px', width: '100%', maxWidth: 480, borderTop: '2px solid #c8a900' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#c8a900', marginBottom: 10 }}>🛎️ 영업 마감</div>
                  <div style={{ fontSize: 14, color: '#ccc', marginBottom: 24, lineHeight: 1.8 }}>
                    {todayReport?.end_time
                      ? '이미 마감된 날입니다. 재마감 시 완료 주문 기준으로 데이터가 갱신됩니다.'
                      : '오늘 영업을 마감할까요? 완료 주문 기준으로 매출이 집계됩니다.'}
                  </div>
                  <button onClick={closeBusiness} style={{ width: '100%', padding: 14, background: '#c8a900', color: '#111', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
                    마감하기
                  </button>
                  <button onClick={() => setClosingConfirm(false)} style={{ width: '100%', padding: 12, background: 'none', color: '#666', border: '1px solid #333', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* 회원 목록 */}
      {tab === 'members' && (
        <div className="member-list">
          {members.length === 0 && <div className="empty">등록된 단골이 없어요</div>}
          {members.map((m, i) => (
            <div key={i} className="member-row">
              <div className="member-avatar" style={{ fontSize: 20 }}>
                {(GRADE_LABEL[m.grade || 'bronze'] || '🥉').split(' ')[0]}
              </div>
              <div className="member-info">
                <div className="member-phone">{m.phone}</div>
                <div className="member-sub">
                  <span style={{ color: GRADE_COLOR[m.grade || 'bronze'], fontWeight: 600 }}>
                    {GRADE_LABEL[m.grade || 'bronze']}
                  </span>
                  {' · '}최근 {m.last_visit?.slice(0, 10) || '-'}
                  {' · '}누적 {won(m.total_spent || 0)}
                </div>
              </div>
              <span className="visit-badge">{m.visit_count}회</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
