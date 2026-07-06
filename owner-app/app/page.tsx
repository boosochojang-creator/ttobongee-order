'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'
import StatsTab from './StatsTab'

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

const GRADE_LABEL: Record<string, string> = {
  gold: '🥇 골드', silver: '🥈 실버', bronze: '🥉 브론즈'
}
const GRADE_COLOR: Record<string, string> = {
  gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32'
}

const PAY_LABELS: Record<string, string> = {
  card: '💳 카드', kakao: '💛 카카오', toss: '💙 토스', cash: '💵 현금', split: '🍗 더치페이'
}

const STATUS_LABEL: Record<string, string> = {
  pending: '신규', paid: '신규', cash_pending: '현금대기',
  verification_failed: '⚠️ 결제확인필요',
  accepted: '접수', cooking: '조리중', done: '조리완료', served: '서빙완료', canceled: '취소'
}

// Phase 4-A CRM: 등급 라벨/색 + 휴면 계산 (휴면/휴면주의는 저장 안 하고 last_visit로 조회 시 계산 — D2)
const CRM_COUNTED = ['paid', 'accepted', 'cooking', 'done', 'served']
const CRM_GRADE_LABEL: Record<string, string> = { new: '신규', normal: '일반', regular: '단골', vip: 'VIP' }
const CRM_GRADE_COLOR: Record<string, string> = { new: '#8a8a8a', normal: '#4a90d9', regular: '#c8a900', vip: '#d98cff' }

function daysSince(dateStr?: string | null) {
  if (!dateStr) return null
  const t = new Date(dateStr).getTime()
  return isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000)
}
// timestamptz → KST(UTC+9) 날짜 YYYY-MM-DD (집계의 방문일 기준과 표시를 일치시킴)
function kstDay(iso?: string | Date | null) {
  if (!iso) return '-'
  const t = new Date(iso).getTime()
  return isNaN(t) ? '-' : new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10)
}
// 표시 등급: 주문 이력이 있고 오래 미방문이면 휴면/휴면주의를 우선 표시(주문기반 등급 위에 덧씌움)
function crmDisplayGrade(customerGrade: string, lastVisit?: string | null, orderCount = 0) {
  const days = daysSince(lastVisit)
  if (orderCount > 0 && days !== null) {
    if (days >= 60) return { label: '💤 휴면', color: '#e05555' }
    if (days >= 30) return { label: '⚠️ 휴면주의', color: '#e0a03a' }
  }
  return { label: CRM_GRADE_LABEL[customerGrade] || '신규', color: CRM_GRADE_COLOR[customerGrade] || '#8a8a8a' }
}
const CRM_GRADE_EMOJI: Record<string, string> = { new: '🌱', normal: '🙂', regular: '🔥', vip: '👑' }

// Phase 4-B: 세그먼트 자동 분류 (전부 read-time 계산 — 저장 안 함)
const SEGMENT_META: { key: string; label: string; color: string }[] = [
  { key: 'new', label: '신규', color: '#8a8a8a' },
  { key: 'normal', label: '일반', color: '#4a90d9' },
  { key: 'regular', label: '단골', color: '#c8a900' },
  { key: 'vip', label: 'VIP', color: '#d98cff' },
  { key: 'dormant_warn', label: '휴면주의', color: '#e0a03a' },
  { key: 'dormant', label: '휴면', color: '#e05555' },
  { key: 'birthday_soon', label: '생일예정', color: '#e08ab0' },
  { key: 'coupon_unused', label: '쿠폰미사용', color: '#43b581' },
  { key: 'delivery', label: '배달가능', color: '#4a90d9' },
  { key: 'marketing', label: '수신동의', color: '#4caf50' },
]
const SEGMENT_LABEL: Record<string, { label: string; color: string }> =
  Object.fromEntries(SEGMENT_META.map(s => [s.key, { label: s.label, color: s.color }]))

// 생일(월·일)이 오늘부터 within일 이내인지 (KST 기준, 연도 무관) — 생일 미입력자는 false
function birthdayWithin(bday: string | null | undefined, within: number) {
  if (!bday) return false
  const d = new Date(bday); if (isNaN(d.getTime())) return false
  const bkey = (d.getUTCMonth() + 1) * 100 + d.getUTCDate() // birthday는 date형(시분 없음) → UTC 파트가 곧 달력값
  const now = new Date(Date.now() + 9 * 3600 * 1000)         // KST 오늘
  for (let i = 0; i <= within; i++) {
    const t = new Date(now.getTime() + i * 86400000)
    if ((t.getUTCMonth() + 1) * 100 + t.getUTCDate() === bkey) return true
  }
  return false
}

// 회원 1명의 세그먼트 태그 배열
function computeSegments(m: any, ctx: { couponUsers: Set<string>; deliveryUsers: Set<string> }) {
  const segs: string[] = [m.customer_grade || 'new'] // 등급(신규/일반/단골/VIP)
  const days = daysSince(m.last_visit)
  if ((m.total_order_count || 0) > 0 && days !== null) {
    if (days >= 60) segs.push('dormant')
    else if (days >= 30) segs.push('dormant_warn')
  }
  if (birthdayWithin(m.birthday, 7)) segs.push('birthday_soon')
  if (ctx.couponUsers.has(m.id)) segs.push('coupon_unused')
  if (ctx.deliveryUsers.has(m.id)) segs.push('delivery')
  if (m.marketing_opt_in) segs.push('marketing')
  return segs
}

// 상태 배지 (가입완료/정보부족/주소있음/생일있음/수신동의/수신거부) — '회원가입' 유도 문구는 쓰지 않음
function Pill({ t, c }: { t: string; c: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color: c, background: c + '22', border: `1px solid ${c}55`, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>{t}</span>
}
function MemberBadges({ m }: { m: any }) {
  const hasAddr = !!(m.address_saved || m.address)
  const hasBday = !!(m.birthday_saved || m.birthday)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {m.member_status === 'profile_complete'
        ? <Pill t="가입완료" c="#4caf50" />
        : <Pill t="정보부족" c="#888" />}
      {hasAddr && <Pill t="주소있음" c="#4a90d9" />}
      {hasBday && <Pill t="생일있음" c="#e08ab0" />}
      {m.marketing_opt_in ? <Pill t="수신동의" c="#4caf50" /> : <Pill t="수신거부" c="#999" />}
    </div>
  )
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
  const [selectedMember, setSelectedMember] = useState<any | null>(null) // CRM 고객 상세
  const [segFilter, setSegFilter] = useState<string | null>(null)        // 세그먼트 필터
  const [memberOrders, setMemberOrders] = useState<any[]>([])            // 상세: 주문이력
  const [memberDetailLoading, setMemberDetailLoading] = useState(false)
  const [tab, setTab] = useState<'orders' | 'menu' | 'members' | 'sales' | 'business' | 'stats'>('orders')
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

  function speakOrder(tableNo: number, orderType: string, paymentMethod: string) {
    try {
      const label = orderType === 'delivery' ? '배달' : orderType === 'takeout' ? '포장' : `${tableNo}번 테이블`
      const message = paymentMethod === 'cash'
        ? `${label} 신규 주문입니다 — 현금결제입니다. 확인 후 접수해 주세요.`
        : `${label} 신규 주문입니다`
      const u = new SpeechSynthesisUtterance(message)
      u.lang = 'ko-KR'; u.volume = 1; u.rate = 0.85
      window.speechSynthesis.speak(u)
    } catch {}
  }

  const loadOrders = useCallback(async () => {
    const today = kstDay(new Date()) // KST 오늘 (영업일 기준)
    const { data } = await supabase
      .from('orders')
      .select(`*,
               order_items(name_snapshot, qty, subtotal),
               users(visit_count, grade)`)
      .eq('store_id', 'baegun')
      .neq('status', 'canceled')
      // pending = 손님이 결제창만 열고 아직 결제 안 한 상태(취소·이탈 포함) → 확정 전이므로 점주 화면에서 제외
      .neq('status', 'pending')
      .gte('created_at', `${today}T00:00:00+09:00`)
      .order('created_at', { ascending: false })

    if (!data) return

    const mapped = data.map((o: any) => ({ ...o, items: o.order_items, member_info: o.users || null }))

    // 새 주문 감지 → 알림음
    if (!isFirst.current) {
      mapped.forEach(o => {
        if (!seenIds.current.has(o.id) && (o.status === 'paid' || o.status === 'cash_pending' || o.status === 'verification_failed')) {
          playAlert()
          speakOrder(o.table_no, o.order_type, o.payment_method)
          setHideDone(false)
        }
      })
    }
    mapped.forEach(o => seenIds.current.add(o.id))
    isFirst.current = false

    setOrders(mapped)

    // 요약
    const done = mapped.filter(o => ['accepted','cooking','done','served'].includes(o.status))
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
    const { data: users } = await supabase.from('users')
      .select('id, phone, nickname, created_at, last_visit, first_order_at, last_order_at, visit_count, total_order_count, total_spent, average_order_amount, customer_grade, grade, member_status, marketing_opt_in, address_saved, birthday_saved, birthday, address, email')
      .eq('store_id', 'baegun')
    if (!users) return

    // 선호메뉴: 완료 주문의 order_items에서 회원별 최다 주문 메뉴(수량 기준) — favorite_menu_id는 integer라 미사용, 조회 시 계산
    const { data: cntOrders } = await supabase.from('orders')
      .select('id, user_id').in('status', CRM_COUNTED).not('user_id', 'is', null)
    const orderUser = new Map((cntOrders || []).map(o => [o.id, o.user_id]))
    const orderIds = (cntOrders || []).map(o => o.id)
    const favByUser: Record<string, Record<string, number>> = {}
    if (orderIds.length) {
      const { data: items } = await supabase.from('order_items')
        .select('order_id, name_snapshot, qty').in('order_id', orderIds)
      for (const it of items || []) {
        const uid = orderUser.get(it.order_id); if (!uid) continue
        ;(favByUser[uid] ||= {})[it.name_snapshot] = (favByUser[uid][it.name_snapshot] || 0) + (it.qty || 0)
      }
    }
    const favOf = (uid: string) => {
      const m = favByUser[uid]; if (!m) return null
      return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || null
    }

    // 세그먼트용 보조 데이터: 유효 쿠폰(미사용·미만료) 보유자 + 배달 이력 보유자
    const nowIso = new Date().toISOString()
    const { data: coup } = await supabase.from('coupons').select('user_id').eq('status', 'active').gt('expires_at', nowIso)
    const couponUsers = new Set((coup || []).map(c => c.user_id))
    const { data: delo } = await supabase.from('orders').select('user_id')
      .eq('order_type', 'delivery').not('delivery_address', 'is', null).not('user_id', 'is', null)
    const deliveryUsers = new Set((delo || []).map(o => o.user_id))

    const rows = users
      .map(u => {
        const r: any = { ...u, favorite_menu: favOf(u.id) }
        r.segments = computeSegments(r, { couponUsers, deliveryUsers })
        return r
      })
      .sort((a, b) => (b.total_order_count || 0) - (a.total_order_count || 0) || (b.total_spent || 0) - (a.total_spent || 0))
    setMembers(rows)
  }

  // 상세 열기: 선택 + 해당 고객의 완료 주문 이력(항목 포함) 로드 (집계와 같은 CRM_COUNTED 기준)
  const openMember = async (m: any) => {
    setSelectedMember(m)
    setMemberOrders([])
    setMemberDetailLoading(true)
    const { data } = await supabase.from('orders')
      .select('id, created_at, final_amount, status, payment_method, order_items(name_snapshot, qty)')
      .eq('user_id', m.id).in('status', CRM_COUNTED)
      .order('created_at', { ascending: false })
    setMemberOrders(data || [])
    setMemberDetailLoading(false)
  }

  const updateStatus = async (orderId: string, status: string) => {
    const res = await fetch('/api/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, status }),
    }).catch(() => null)
    const result = res ? await res.json().catch(() => null) : null
    if (!result?.ok) {
      // DB가 아직 이 상태값을 모르는 경우(예: served 마이그레이션 전) — 에러 화면 없이 안내만
      setCallToast('⏳ 처리 중 — 상태 변경이 아직 반영되지 않았어요. 잠시 후 다시 눌러주세요.')
      setTimeout(() => setCallToast(null), 3500)
      return
    }
    // 회원 방문/등급/누적 집계는 서버(/api/update-status)에서 서비스롤로 재계산한다.
    // (기존 익명키 클라이언트 UPDATE는 RLS로 조용히 실패하던 B-2 버그 — 제거하고 서버로 이전)
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
    const today = kstDay(new Date()) // KST 오늘 (영업일 기준)
    const { data } = await supabase.from('daily_reports').select('*')
      .eq('store_id', 'baegun').eq('date', today).maybeSingle()
    setTodayReport(data || null)
  }

  const startBusiness = async () => {
    const today = kstDay(new Date()) // KST 오늘 (영업일 기준)
    await supabase.from('daily_reports').upsert(
      { store_id: 'baegun', date: today, start_time: new Date().toISOString() },
      { onConflict: 'store_id,date' }
    )
    await loadTodayReport()
  }

  const closeBusiness = async () => {
    const today = kstDay(new Date()) // KST 오늘 (영업일 기준)
    const { data: raw } = await supabase.from('orders')
      .select('final_amount, payment_method').eq('store_id', 'baegun').eq('status', 'done')
      .gte('created_at', `${today}T00:00:00+09:00`)
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

  const newOrders = orders.filter(o => ['pending', 'paid', 'cash_pending', 'verification_failed'].includes(o.status))
  const acceptedOrders = orders.filter(o => o.status === 'accepted')
  const cookingOrders = orders.filter(o => o.status === 'cooking')
  const doneOrders = orders.filter(o => o.status === 'done')

  const OrderCard = ({ order }: { order: Order }) => (
    <div className={`order-card ${order.status === 'pending' || order.status === 'paid' ? 'new-order' : order.status === 'cash_pending' || order.status === 'verification_failed' ? 'cash_pending' : order.status === 'accepted' ? 'accepted' : order.status === 'cooking' ? 'cooking' : 'done-card'}`}>
      <div className="order-time">{timeAgo(order.created_at)}</div>
      <div className="order-table">
        {order.order_type === 'delivery' ? '🛵 배달' : order.order_type === 'takeout' ? '🛍️ 포장' : `${order.table_no}번`}
        <span> {STATUS_LABEL[order.status] || order.status}</span>
      </div>
      {order.order_type === 'delivery' && (
        /* 배달 정보 — 전화번호 노출은 점주 화면 한정 (라이더 노출은 Phase 5에서 마스킹 처리 예정) */
        <div style={{ background: '#101820', border: '1px solid #2a3a4a', borderRadius: 8, padding: '8px 10px', margin: '6px 0', fontSize: 13, lineHeight: 1.7, color: '#cde' }}>
          <div>📍 {(order as any).delivery_address || '-'}</div>
          <div>
            🛵 배달료 {won((order as any).delivery_fee || 0)}
            {(order as any).delivery_distance_m ? ` · 약 ${(((order as any).delivery_distance_m) / 1000).toFixed(1)}km` : ''}
          </div>
          <div>☎ <a href={`tel:${(order as any).customer_phone || ''}`} style={{ color: '#7fd4ff' }}>{(order as any).customer_phone || '-'}</a></div>
        </div>
      )}
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
        {order.status === 'verification_failed' && (
          /* 금액 불일치 등 검증 실패 — 포트원 콘솔에서 실제 결제 확인 후 수동 접수 */
          <button className="action-btn btn-accept" onClick={() => updateStatus(order.id, 'accepted')}>⚠️ 확인 후 접수</button>
        )}
        {order.status === 'accepted' && (
          <button className="action-btn btn-cooking" onClick={() => updateStatus(order.id, 'cooking')}>🍳 조리시작</button>
        )}
        {order.status === 'cooking' && (
          <button className="action-btn btn-done" onClick={() => updateStatus(order.id, 'done')}>🛎️ 조리완료</button>
        )}
        {order.status === 'done' && (
          <button className="action-btn btn-accept" onClick={() => updateStatus(order.id, 'served')}>✔️ 서빙완료</button>
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
        <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>통계</button>
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

      {/* 통계 (그룹 F-1) */}
      {tab === 'stats' && <StatsTab />}

      {/* 회원 목록 (Phase 4-A CRM + 4-B 세그먼트) */}
      {tab === 'members' && (() => {
        const visible = segFilter ? members.filter(m => (m.segments || []).includes(segFilter)) : members
        const segCount = (key: string) => members.filter(m => (m.segments || []).includes(key)).length
        const chip = (active: boolean, color: string) => ({
          fontSize: 12, fontWeight: 700 as const, padding: '5px 10px', borderRadius: 20, cursor: 'pointer',
          border: `1px solid ${active ? color : '#333'}`, background: active ? color + '22' : 'transparent',
          color: active ? color : '#aaa', whiteSpace: 'nowrap' as const,
        })
        return (
          <div className="member-list">
            {/* 세그먼트 필터 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 10 }}>
              <button onClick={() => setSegFilter(null)} style={chip(!segFilter, '#c8a900')}>전체 {members.length}</button>
              {SEGMENT_META.map(s => (
                <button key={s.key} onClick={() => setSegFilter(segFilter === s.key ? null : s.key)} style={chip(segFilter === s.key, s.color)}>
                  {s.label} {segCount(s.key)}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', padding: '0 0 10px' }}>
              {visible.length}명{segFilter ? ` · ${SEGMENT_LABEL[segFilter]?.label} 필터` : ''} · 이름/전화 클릭 시 상세
            </div>
            {visible.length === 0 && <div className="empty">{segFilter ? '해당 세그먼트 회원이 없어요' : '등록된 회원이 없어요'}</div>}
            {visible.map((m) => {
              const g = crmDisplayGrade(m.customer_grade, m.last_visit, m.total_order_count)
              const name = m.nickname || m.phone
              const extraSegs = (m.segments || []).filter((k: string) => ['birthday_soon', 'coupon_unused', 'delivery'].includes(k))
              return (
                <div key={m.id} className="member-row" style={{ cursor: 'pointer', alignItems: 'flex-start' }} onClick={() => openMember(m)}>
                  <div className="member-avatar" style={{ fontSize: 20 }}>{CRM_GRADE_EMOJI[m.customer_grade] || '🌱'}</div>
                  <div className="member-info">
                    <div className="member-phone">
                      {name}
                      <span style={{ color: g.color, fontWeight: 700, fontSize: 12, marginLeft: 6 }}>{g.label}</span>
                    </div>
                    <div className="member-sub">
                      {name !== m.phone && <>{m.phone} · </>}
                      가입 {kstDay(m.created_at)} · 최근방문 {kstDay(m.last_visit)}
                    </div>
                    <div className="member-sub" style={{ marginTop: 3 }}>
                      방문 {m.visit_count || 0}회 · 주문 {m.total_order_count || 0}회 · 누적 {won(m.total_spent || 0)} · 평균 {won(m.average_order_amount || 0)}
                    </div>
                    {m.favorite_menu && <div className="member-sub" style={{ marginTop: 2 }}>선호 🍗 {m.favorite_menu}</div>}
                    <div style={{ marginTop: 6 }}><MemberBadges m={m} /></div>
                    {extraSegs.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {extraSegs.map((k: string) => <Pill key={k} t={SEGMENT_LABEL[k].label} c={SEGMENT_LABEL[k].color} />)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* 고객 상세 (Stage 2: 기본정보+집계+배지 / 주문·방문 이력은 Stage 3에서 추가) */}
      {selectedMember && (() => {
        const m = selectedMember
        const g = crmDisplayGrade(m.customer_grade, m.last_visit, m.total_order_count)
        const name = m.nickname || m.phone
        const vc = m.visit_count || 0
        let interval = '-'
        if (vc >= 2 && m.first_order_at && m.last_order_at) {
          const span = (new Date(m.last_order_at).getTime() - new Date(m.first_order_at).getTime()) / 86400000
          interval = `약 ${Math.max(1, Math.round(span / (vc - 1)))}일`
        }
        const Row = ({ k, v }: { k: string; v: any }) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
            <span style={{ color: 'var(--text2)' }}>{k}</span>
            <span style={{ fontWeight: 600, textAlign: 'right' }}>{v ?? '-'}</span>
          </div>
        )
        return (
          <div onClick={() => setSelectedMember(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg2)', borderRadius: '18px 18px 0 0', padding: '20px 18px 32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 19, fontWeight: 900 }}>
                  {CRM_GRADE_EMOJI[m.customer_grade] || '🌱'} {name}
                  <span style={{ color: g.color, fontWeight: 700, fontSize: 13, marginLeft: 8 }}>{g.label}</span>
                </div>
                <button onClick={() => setSelectedMember(null)} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 22, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ marginBottom: 14 }}><MemberBadges m={m} /></div>

              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)', margin: '6px 0' }}>기본정보</div>
              <Row k="이름/닉네임" v={m.nickname || '-'} />
              <Row k="전화번호" v={m.phone} />
              <Row k="생일" v={m.birthday || '-'} />
              <Row k="주소" v={m.address || '-'} />
              <Row k="이메일" v={m.email || '-'} />
              <Row k="가입일" v={kstDay(m.created_at)} />

              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)', margin: '16px 0 6px' }}>주문 요약</div>
              <Row k="총 주문횟수" v={`${m.total_order_count || 0}회`} />
              <Row k="총 주문금액" v={won(m.total_spent || 0)} />
              <Row k="평균 주문금액" v={won(m.average_order_amount || 0)} />
              <Row k="선호 메뉴" v={m.favorite_menu || '-'} />

              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)', margin: '16px 0 6px' }}>방문 이력</div>
              <Row k="첫 방문" v={kstDay(m.first_order_at)} />
              <Row k="최근 방문" v={kstDay(m.last_visit)} />
              <Row k="총 방문횟수" v={`${vc}회`} />
              <Row k="평균 방문간격" v={interval} />

              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)', margin: '16px 0 6px' }}>주문 이력</div>
              {memberDetailLoading ? (
                <div style={{ color: 'var(--text2)', fontSize: 13, padding: '10px 0' }}>불러오는 중…</div>
              ) : memberOrders.length === 0 ? (
                <div style={{ color: 'var(--text2)', fontSize: 13, padding: '10px 0' }}>완료된 주문 이력이 없어요</div>
              ) : (
                memberOrders.map(o => (
                  <div key={o.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                      <span>{kstDay(o.created_at)}{' '}
                        <span style={{ color: 'var(--text2)', fontWeight: 400 }}>{PAY_LABELS[o.payment_method] || o.payment_method || ''}</span>
                      </span>
                      <span style={{ color: 'var(--gold)' }}>{won(o.final_amount || 0)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                      {(o.order_items || []).map((i: any) => `${i.name_snapshot}${i.qty > 1 ? ` x${i.qty}` : ''}`).join(', ') || '-'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
