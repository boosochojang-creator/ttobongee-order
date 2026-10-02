'use client'

// 그룹 F-1: 매출/메뉴/테이블/주문유형 통계 + 자재마이닝 (정부 지원금·본사 보고용)
// 날짜 경계는 매장 운영시간 기준(KST, UTC+9)으로 명시적으로 고정한다 — UTC/KST 혼동 방지.
// 집계 대상: canceled / pending / verification_failed 제외 (금액이 확정되지 않은 주문 제외)
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './lib/supabase'
import CouponStats from './CouponStats'
import { SALES_COUNTED } from './lib/salesStatus'
import { STORE_ID } from './lib/store'
import { tableLabel } from './lib/tableLabel'

type Period = 'day' | 'week' | 'month' | 'quarter' | 'year'

type OrderRow = {
  id: string
  user_id: string | null
  table_no: number
  order_type: string
  status: string
  final_amount: number
  created_at: string
  order_items: { menu_id: string | null; name_snapshot: string; qty: number; subtotal: number }[]
}

type Ingredient = { menu_id: string; ingredient_name: string; amount_per_serving: number; unit: string }

// F-2: 고객관리 통계용
type UserRow = { id: string; created_at: string; marketing_opt_in: boolean | null; member_status: string | null; last_visit: string | null; nickname: string | null; grade: string | null }
type UserOrderRow = { user_id: string; created_at: string }

const KST = '+09:00'
const DAY_MS = 24 * 60 * 60 * 1000
const won = (n: number) => (n || 0).toLocaleString() + '원'

// KST 자정 기준 epoch (yyyy-mm-dd는 KST 달력 날짜)
function kstMidnight(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00${KST}`).getTime()
}
// epoch → KST 달력 날짜 문자열
function toKstDateStr(epoch: number): string {
  return new Date(epoch + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// 기간 계산: 전부 KST 달력 기준. [start, end) 반환
function kstRange(period: Period, anchor: string): { start: number; end: number; label: string } {
  const [y, m, d] = anchor.split('-').map(Number)
  switch (period) {
    case 'day': {
      const start = kstMidnight(anchor)
      return { start, end: start + DAY_MS, label: `${y}년 ${m}월 ${d}일` }
    }
    case 'week': {
      const anchorMid = kstMidnight(anchor)
      // KST 기준 요일 (월요일 시작)
      const dow = new Date(anchorMid + 9 * 3600 * 1000).getUTCDay() // 0=일
      const offset = dow === 0 ? 6 : dow - 1
      const start = anchorMid - offset * DAY_MS
      return { start, end: start + 7 * DAY_MS, label: `${toKstDateStr(start)} ~ ${toKstDateStr(start + 6 * DAY_MS)} (주간)` }
    }
    case 'month': {
      const start = kstMidnight(`${y}-${String(m).padStart(2, '0')}-01`)
      const nm = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
      return { start, end: kstMidnight(nm), label: `${y}년 ${m}월` }
    }
    case 'quarter': {
      const q = Math.floor((m - 1) / 3) // 0~3
      const sm = q * 3 + 1
      const start = kstMidnight(`${y}-${String(sm).padStart(2, '0')}-01`)
      const endStr = sm + 3 > 12 ? `${y + 1}-01-01` : `${y}-${String(sm + 3).padStart(2, '0')}-01`
      return { start, end: kstMidnight(endStr), label: `${y}년 ${q + 1}분기` }
    }
    case 'year': {
      const start = kstMidnight(`${y}-01-01`)
      return { start, end: kstMidnight(`${y + 1}-01-01`), label: `${y}년` }
    }
  }
}

// 기간 이동 (◀ ▶): anchor 날짜를 기간 단위만큼 이동
function shiftAnchor(period: Period, anchor: string, dir: 1 | -1): string {
  const [y, m, d] = anchor.split('-').map(Number)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (period === 'day') return toKstDateStr(kstMidnight(anchor) + dir * DAY_MS)
  if (period === 'week') return toKstDateStr(kstMidnight(anchor) + dir * 7 * DAY_MS)
  if (period === 'month') {
    const t = y * 12 + (m - 1) + dir
    return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}-01`
  }
  if (period === 'quarter') {
    const t = y * 12 + (m - 1) + dir * 3
    return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}-01`
  }
  return `${y + dir}-${pad(m)}-${pad(d)}`
}

const ORDER_TYPE_LABEL: Record<string, string> = { dine_in: '매장식사', takeout: '포장', delivery: '배달' }
const PERIOD_LABEL: Record<Period, string> = { day: '일', week: '주', month: '월', quarter: '분기', year: '연' }

const box: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }
const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', color: '#c8a900', fontSize: 13, borderBottom: '1px solid #333', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '6px 8px', color: '#ccc', fontSize: 13, borderBottom: '1px solid #222', whiteSpace: 'nowrap' }

export default function StatsTab() {
  const [period, setPeriod] = useState<Period>('day')
  const [anchor, setAnchor] = useState(() => toKstDateStr(Date.now()))
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[] | null>(null) // null = 테이블 없음/미조회
  const [loading, setLoading] = useState(false)

  const range = useMemo(() => kstRange(period, anchor), [period, anchor])

  useEffect(() => {
    let alive = true
    setLoading(true)
    supabase.from('orders')
      .select('id, user_id, table_no, order_type, status, final_amount, created_at, order_items(menu_id, name_snapshot, qty, subtotal)')
      .eq('store_id', STORE_ID)
      .gte('created_at', new Date(range.start).toISOString())
      .lt('created_at', new Date(range.end).toISOString())
      .in('status', SALES_COUNTED) // [4][11] 확정 매출만 — cash_pending(미결제) 등 제외, 화면 전체와 동일 기준
      .then(({ data }) => {
        if (!alive) return
        setOrders((data as OrderRow[]) || [])
        setLoading(false)
      })
    return () => { alive = false }
  }, [range.start, range.end])

  useEffect(() => {
    supabase.from('menu_ingredients')
      .select('menu_id, ingredient_name, amount_per_serving, unit')
      .then(({ data, error }) => setIngredients(error ? null : (data as Ingredient[])))
  }, [])

  // F-2: 회원 전체 + 회원 주문 이력 (재방문·휴면은 visit_count가 아닌 주문 이력 기반 — 갱신 버그와 무관하게 정확)
  const [members, setMembers] = useState<UserRow[]>([])
  const [memberOrders, setMemberOrders] = useState<UserOrderRow[]>([])
  useEffect(() => {
    supabase.from('users')
      .select('id, created_at, marketing_opt_in, member_status, last_visit, nickname, grade')
      .eq('store_id', STORE_ID)
      .then(({ data }) => setMembers((data as UserRow[]) || []))
    supabase.from('orders')
      .select('user_id, created_at')
      .eq('store_id', STORE_ID)
      .not('user_id', 'is', null)
      .in('status', SALES_COUNTED) // [4] 방문/재방문 집계도 동일 기준
      .then(({ data }) => setMemberOrders((data as UserOrderRow[]) || []))
  }, [])

  // F-2 집계 (+ 드릴다운용 회원 명단)
  const crm = useMemo(() => {
    const byId = new Map<string, UserRow>()
    for (const u of members) byId.set(u.id, u)

    // 신규회원: 기간 내 가입 (KST 경계는 range와 동일)
    const newList = members.filter(u => {
      const t = new Date(u.created_at).getTime()
      return t >= range.start && t < range.end
    })

    // 재방문: 기간 내 주문한 회원 중, 기간 시작 전에도 주문 이력이 있는 회원
    const firstOrder = new Map<string, number>()
    const lastOrder = new Map<string, number>()
    for (const o of memberOrders) {
      const t = new Date(o.created_at).getTime()
      if (!firstOrder.has(o.user_id) || t < firstOrder.get(o.user_id)!) firstOrder.set(o.user_id, t)
      if (!lastOrder.has(o.user_id) || t > lastOrder.get(o.user_id)!) lastOrder.set(o.user_id, t)
    }
    const visitorSet = new Set<string>()
    for (const o of memberOrders) {
      const t = new Date(o.created_at).getTime()
      if (t >= range.start && t < range.end) visitorSet.add(o.user_id)
    }
    const visitorList: UserRow[] = []
    const revisitList: UserRow[] = []
    visitorSet.forEach(uid => {
      const u = byId.get(uid); if (!u) return
      visitorList.push(u)
      if ((firstOrder.get(uid) ?? Infinity) < range.start) revisitList.push(u)
    })

    // 마케팅 동의
    const optInList = members.filter(u => u.marketing_opt_in === true)

    // 상태별 분포 (status 없는 옛 데이터 = phone_member)
    const statusLists: Record<string, UserRow[]> = { phone_member: [], profile_incomplete: [], profile_complete: [] }
    for (const u of members) {
      const s = u.member_status || 'phone_member'
      ;(statusLists[s] = statusLists[s] || []).push(u)
    }

    // 휴면: 마지막 활동(주문 이력 우선, 없으면 last_visit/가입일)로부터 경과일 — CRM 트리거 구간(10일/45~60일) 기준
    const now = Date.now()
    const dormantLists = { active: [] as UserRow[], d10: [] as UserRow[], d45: [] as UserRow[], d60: [] as UserRow[] }
    for (const u of members) {
      const last = lastOrder.get(u.id)
        ?? (u.last_visit ? new Date(u.last_visit).getTime() : new Date(u.created_at).getTime())
      const days = Math.floor((now - last) / DAY_MS)
      if (days < 10) dormantLists.active.push(u)
      else if (days < 45) dormantLists.d10.push(u)
      else if (days <= 60) dormantLists.d45.push(u)
      else dormantLists.d60.push(u)
    }

    const statusDist = { phone_member: statusLists.phone_member.length, profile_incomplete: statusLists.profile_incomplete.length, profile_complete: statusLists.profile_complete.length }
    const dormant = { active: dormantLists.active.length, d10: dormantLists.d10.length, d45: dormantLists.d45.length, d60: dormantLists.d60.length }
    return {
      newMembers: newList.length, visitors: visitorSet.size, revisit: revisitList.length,
      revisitRate: visitorSet.size ? Math.round(revisitList.length / visitorSet.size * 100) : 0,
      optIn: optInList.length, total: members.length, statusDist, dormant,
      byId, lastOrder, newList, visitorList, revisitList, optInList, statusLists, dormantLists,
    }
  }, [members, memberOrders, range.start, range.end])

  const agg = useMemo(() => {
    const totalSales = orders.reduce((s, o) => s + (o.final_amount || 0), 0)
    const count = orders.length

    const byMenu = new Map<string, { qty: number; sales: number; menuId: string | null }>()
    const byTable = new Map<string, { count: number; sales: number }>()
    const byType = new Map<string, { count: number; sales: number }>()

    for (const o of orders) {
      const tKey = o.order_type === 'delivery' ? '배달' : o.order_type === 'takeout' ? '포장' : tableLabel(o.table_no)
      const t = byTable.get(tKey) || { count: 0, sales: 0 }
      t.count += 1; t.sales += o.final_amount || 0
      byTable.set(tKey, t)

      const yKey = ORDER_TYPE_LABEL[o.order_type] || o.order_type || '기타'
      const yv = byType.get(yKey) || { count: 0, sales: 0 }
      yv.count += 1; yv.sales += o.final_amount || 0
      byType.set(yKey, yv)

      for (const it of o.order_items || []) {
        const m = byMenu.get(it.name_snapshot) || { qty: 0, sales: 0, menuId: it.menu_id }
        m.qty += it.qty; m.sales += it.subtotal || 0
        byMenu.set(it.name_snapshot, m)
      }
    }

    const menuRank = Array.from(byMenu.entries()).sort((a, b) => b[1].sales - a[1].sales)
    const tableRank = Array.from(byTable.entries()).sort((a, b) => b[1].sales - a[1].sales)
    const typeRank = Array.from(byType.entries()).sort((a, b) => b[1].sales - a[1].sales)

    // 자재마이닝: 판매수량 × 레시피 소요량
    const matUse = new Map<string, { amount: number; unit: string }>()
    if (ingredients && ingredients.length) {
      const soldByMenuId = new Map<string, number>()
      for (const o of orders) for (const it of o.order_items || []) {
        if (it.menu_id) soldByMenuId.set(it.menu_id, (soldByMenuId.get(it.menu_id) || 0) + it.qty)
      }
      for (const ing of ingredients) {
        const sold = soldByMenuId.get(ing.menu_id) || 0
        if (!sold) continue
        const key = `${ing.ingredient_name}|${ing.unit}`
        const cur = matUse.get(key) || { amount: 0, unit: ing.unit }
        cur.amount += sold * Number(ing.amount_per_serving)
        matUse.set(key, cur)
      }
    }
    const materials = Array.from(matUse.entries())
      .map(([key, v]) => ({ name: key.split('|')[0], ...v }))
      .sort((a, b) => b.amount - a.amount)

    return { totalSales, count, avg: count ? Math.round(totalSales / count) : 0, menuRank, tableRank, typeRank, materials }
  }, [orders, ingredients])

  // ===== F-3: 제출용 리포트 (엑셀 / PDF) =====
  const reportTitle = `또봉이통닭 백운역점 매출·고객 현황 보고서`
  const issuedAt = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10) // KST 발행일

  const downloadExcel = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const sum: (string | number)[][] = [
      [reportTitle], [`기간: ${range.label} (KST 기준)`, `발행일: ${issuedAt()}`], [],
      ['— 매출 요약 —'], ['총 매출(원)', agg.totalSales], ['주문 건수', agg.count], ['객단가(원)', agg.avg], [],
      ['— 고객 현황 —'], ['신규 가입(기간 내)', crm.newMembers], ['방문 회원(기간 내)', crm.visitors],
      ['재방문 회원', crm.revisit], ['재방문율(%)', crm.revisitRate],
      ['마케팅 수신동의', `${crm.optIn} / ${crm.total}`],
      ['휴면 10~44일', crm.dormant.d10], ['휴면 45~60일', crm.dormant.d45], ['휴면 60일 초과', crm.dormant.d60],
      ['상태: 전화번호만', crm.statusDist.phone_member || 0], ['상태: 일부입력', crm.statusDist.profile_incomplete || 0], ['상태: 완료입력', crm.statusDist.profile_complete || 0],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), '요약')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
      [['순위', '메뉴', '수량', '매출액(원)'], ...agg.menuRank.map(([n, v], i) => [i + 1, n, v.qty, v.sales])]), '메뉴별')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
      [['테이블', '주문건수', '매출액(원)'], ...agg.tableRank.map(([t, v]) => [t, v.count, v.sales])]), '테이블별')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
      [['유형', '건수', '매출액(원)', '비중(%)'], ...agg.typeRank.map(([t, v]) => [t, v.count, v.sales, agg.totalSales ? Math.round(v.sales / agg.totalSales * 100) : 0])]), '주문유형별')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
      [['자재', '총 소요량', '단위'], ...agg.materials.map(m => [m.name, Number(m.amount.toFixed(2)), m.unit])]), '자재소요량')
    XLSX.writeFile(wb, `또봉이_보고서_${range.label.replace(/[^\w가-힣~년월일분기]/g, '_')}.xlsx`)
  }

  const openPdfReport = () => {
    const tbl = (heads: string[], rows: (string | number)[][]) =>
      `<table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${
        rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${heads.length}">내역 없음</td></tr>`
      }</tbody></table>`
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${reportTitle}</title><style>
      body{font-family:'Malgun Gothic',sans-serif;color:#111;margin:32px;font-size:12px}
      h1{font-size:18px;border-bottom:3px solid #111;padding-bottom:8px} h2{font-size:14px;margin:18px 0 6px}
      table{border-collapse:collapse;width:100%;margin-bottom:8px} th,td{border:1px solid #888;padding:4px 8px;text-align:left}
      th{background:#f0f0f0} .meta{color:#444;margin-bottom:16px} .btn{position:fixed;top:10px;right:10px;padding:10px 18px;font-size:14px;cursor:pointer}
      @media print{.btn{display:none}}
    </style></head><body>
      <button class="btn" onclick="window.print()">🖨️ PDF로 저장 (인쇄)</button>
      <h1>${reportTitle}</h1>
      <div class="meta">기간: <b>${range.label}</b> (한국시간 기준) · 발행일: ${issuedAt()}</div>
      <h2>1. 매출 요약</h2>
      ${tbl(['총 매출', '주문 건수', '객단가'], [[won(agg.totalSales), `${agg.count}건`, won(agg.avg)]])}
      <h2>2. 메뉴별 판매</h2>
      ${tbl(['순위', '메뉴', '수량', '매출액'], agg.menuRank.map(([n, v], i) => [i + 1, n, `${v.qty}개`, won(v.sales)]))}
      <h2>3. 테이블별</h2>
      ${tbl(['테이블', '주문 건수', '매출액'], agg.tableRank.map(([t, v]) => [t, `${v.count}건`, won(v.sales)]))}
      <h2>4. 주문유형별</h2>
      ${tbl(['유형', '건수', '매출액', '비중'], agg.typeRank.map(([t, v]) => [t, `${v.count}건`, won(v.sales), `${agg.totalSales ? Math.round(v.sales / agg.totalSales * 100) : 0}%`]))}
      <h2>5. 자재 소요량</h2>
      ${tbl(['자재', '총 소요량'], agg.materials.map(m => [m.name, `${Number(m.amount.toFixed(2)).toLocaleString()} ${m.unit}`]))}
      <h2>6. 고객 현황</h2>
      ${tbl(['신규 가입', '방문 회원', '재방문', '재방문율', '마케팅 동의'],
        [[`${crm.newMembers}명`, `${crm.visitors}명`, `${crm.revisit}명`, `${crm.revisitRate}%`, `${crm.optIn}/${crm.total}명`]])}
      ${tbl(['휴면 10~44일', '휴면 45~60일', '휴면 60일 초과', '상태: 전화번호만', '상태: 일부입력', '상태: 완료입력'],
        [[`${crm.dormant.d10}명`, `${crm.dormant.d45}명`, `${crm.dormant.d60}명`, `${crm.statusDist.phone_member || 0}명`, `${crm.statusDist.profile_incomplete || 0}명`, `${crm.statusDist.profile_complete || 0}명`]])}
    </body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
  }

  // ===== 드릴다운(총계 → 상세 명단) =====
  const [detail, setDetail] = useState<{ title: string; body: ReactNode } | null>(null)
  const nameOf = (u: UserRow) => (u.nickname || '').trim() || `손님 ${u.id.slice(0, 6)}`
  const nameById = (uid: string | null) => { if (!uid) return '비회원'; const u = crm.byId.get(uid); return u ? nameOf(u) : `손님 ${uid.slice(0, 6)}` }
  const kstDate = (t?: number | string | null) => t ? new Date(new Date(t).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10) : '-'
  const kstTime = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(11, 16)
  const GRADE_KO: Record<string, string> = { gold: '골드', silver: '실버', bronze: '브론즈' }

  // 특정 회원에게 알림(1:1 메시지 + 웹푸시) — 기존 messages/send 재사용
  const sendAlert = async (uid: string, who: string) => {
    const msg = window.prompt(`「${who}」님에게 보낼 메시지 (앱 알림 + 메시지함으로 전달됩니다)`, '안녕하세요, 또봉이통닭입니다. ')
    if (msg == null || !msg.trim()) return
    try {
      const r = await fetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid, body: msg.trim() }) }).then(x => x.json())
      window.alert(r?.ok ? `✅ 「${who}」님에게 보냈어요${r.notified ? ' (푸시 알림 전송됨)' : ' (앱 메시지함에 저장 · 푸시 미구독)'}` : `❌ 실패: ${r?.error || '오류'}`)
    } catch { window.alert('❌ 전송 실패') }
  }

  const rowClickable: React.CSSProperties = { cursor: 'pointer' }
  const alertBtn: React.CSSProperties = { padding: '4px 10px', fontSize: 12, fontWeight: 700, color: '#111', background: '#c8a900', border: 'none', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }

  // 회원 명단 모달 본문
  const memberListBody = (list: UserRow[]): ReactNode => (
    list.length === 0 ? <div style={{ color: '#888', fontSize: 13, padding: 8 }}>해당 회원이 없어요.</div> : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>회원</th><th style={th}>등급</th><th style={th}>마지막주문</th><th style={th}>연락</th></tr></thead>
          <tbody>
            {list.map(u => (
              <tr key={u.id}>
                <td style={td}>{nameOf(u)}</td>
                <td style={td}>{GRADE_KO[u.grade || 'bronze'] || u.grade || '-'}</td>
                <td style={td}>{kstDate(crm.lastOrder.get(u.id) ?? u.last_visit)}</td>
                <td style={td}><button style={alertBtn} onClick={() => sendAlert(u.id, nameOf(u))}>🔔 알림</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  )
  const openMembers = (title: string, list: UserRow[]) => setDetail({ title, body: memberListBody(list) })

  // 특정 테이블/유형의 주문 상세(세션 시간대·주최자 회원·항목·금액)
  const orderListBody = (rows: OrderRow[]): ReactNode => {
    const sorted = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const hosts = Array.from(new Set(sorted.map(o => o.user_id).filter(Boolean))) as string[]
    return (
      <>
        {hosts.length > 0 && (
          <div style={{ ...box, marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: '#c8a900', fontWeight: 700, marginBottom: 6 }}>이용 회원(주최자) · 정산/연락 대상</div>
            {hosts.map(uid => (
              <div key={uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: 13, color: '#eee' }}>{nameById(uid)} <span style={{ color: '#888', fontSize: 12 }}>({GRADE_KO[crm.byId.get(uid)?.grade || 'bronze'] || '-'})</span></span>
                <button style={alertBtn} onClick={() => sendAlert(uid, nameById(uid))}>🔔 알림 보내기</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>시간</th><th style={th}>회원</th><th style={th}>주문내역</th><th style={th}>금액</th></tr></thead>
            <tbody>
              {sorted.map(o => (
                <tr key={o.id}>
                  <td style={td}>{kstTime(o.created_at)}</td>
                  <td style={td}>{nameById(o.user_id)}</td>
                  <td style={{ ...td, whiteSpace: 'normal' }}>{(o.order_items || []).map(it => `${it.name_snapshot}×${it.qty}`).join(', ') || '-'}</td>
                  <td style={td}>{won(o.final_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }
  const openTable = (tKey: string) => {
    const n = parseInt(tKey, 10)
    const rows = orders.filter(o => (o.order_type === 'delivery' ? '배달' : o.order_type === 'takeout' ? '포장' : tableLabel(o.table_no)) === tKey)
    setDetail({ title: `🪑 ${tKey} 상세 (${range.label})`, body: orderListBody(rows) })
  }
  const openType = (tKey: string) => {
    const rows = orders.filter(o => (ORDER_TYPE_LABEL[o.order_type] || o.order_type || '기타') === tKey)
    setDetail({ title: `🛍️ ${tKey} 상세 (${range.label})`, body: orderListBody(rows) })
  }

  return (
    <div style={{ padding: '0 4px' }}>
      {/* 드릴다운 상세 모달 */}
      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#161616', border: '1px solid #333', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', padding: '18px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#FFD700' }}>{detail.title}</div>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>
            {detail.body}
          </div>
        </div>
      )}
      {/* 기간 선택 */}
      <div style={{ ...box, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {(Object.keys(PERIOD_LABEL) as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: period === p ? '#c8a900' : 'none', color: period === p ? '#111' : '#aaa',
            border: period === p ? 'none' : '1px solid #444',
          }}>{PERIOD_LABEL[p]}</button>
        ))}
        <span style={{ flexBasis: '100%', height: 0 }} />
        <button onClick={() => setAnchor(a => shiftAnchor(period, a, -1))} style={{ background: 'none', border: '1px solid #444', borderRadius: 8, color: '#aaa', padding: '4px 10px', cursor: 'pointer' }}>◀</button>
        <strong style={{ color: '#f0f0f0', fontSize: 15 }}>{range.label}</strong>
        <button onClick={() => setAnchor(a => shiftAnchor(period, a, 1))} style={{ background: 'none', border: '1px solid #444', borderRadius: 8, color: '#aaa', padding: '4px 10px', cursor: 'pointer' }}>▶</button>
        {period === 'day' && (
          <input type="date" value={anchor} onChange={e => e.target.value && setAnchor(e.target.value)}
            style={{ background: '#111', border: '1px solid #444', borderRadius: 8, color: '#ccc', padding: '4px 8px', fontSize: 13 }} />
        )}
        <span style={{ fontSize: 11, color: '#666' }}>* 한국시간(KST) 기준</span>
      </div>

      {loading ? <div style={{ color: '#888', padding: 20, textAlign: 'center' }}>집계 중…</div> : (
      <>
      {/* 매출 요약 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[['총 매출', won(agg.totalSales)], ['주문 건수', `${agg.count}건`], ['객단가', won(agg.avg)]].map(([t, v]) => (
          <div key={t} style={{ ...box, flex: 1, marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{t}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#FFD700' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* 메뉴별 */}
      <div style={box}>
        <div style={{ fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>🍗 메뉴별 판매 순위</div>
        {agg.menuRank.length === 0 ? <div style={{ color: '#666', fontSize: 13 }}>판매 내역 없음</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>순위</th><th style={th}>메뉴</th><th style={th}>수량</th><th style={th}>매출액</th></tr></thead>
              <tbody>
                {agg.menuRank.map(([name, v], i) => (
                  <tr key={name}><td style={td}>{i + 1}</td><td style={td}>{name}</td><td style={td}>{v.qty}개</td><td style={td}>{won(v.sales)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 테이블별 — 행 탭 시 그 테이블의 시간대·주최자·주문 상세 */}
      <div style={box}>
        <div style={{ fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>🪑 테이블별 <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>· 행을 누르면 이용 고객·주문 상세</span></div>
        {agg.tableRank.length === 0 ? <div style={{ color: '#666', fontSize: 13 }}>내역 없음</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>테이블</th><th style={th}>주문 건수</th><th style={th}>매출액</th><th style={th}></th></tr></thead>
            <tbody>
              {agg.tableRank.map(([t, v]) => (
                <tr key={t} style={rowClickable} onClick={() => openTable(t)}>
                  <td style={td}>{t}</td><td style={td}>{v.count}건</td><td style={td}>{won(v.sales)}</td><td style={{ ...td, color: '#c8a900' }}>상세 ›</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 주문유형별 */}
      <div style={box}>
        <div style={{ fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>🛍️ 주문유형별</div>
        {agg.typeRank.length === 0 ? <div style={{ color: '#666', fontSize: 13 }}>내역 없음</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>유형</th><th style={th}>건수</th><th style={th}>매출액</th><th style={th}>비중</th></tr></thead>
            <tbody>
              {agg.typeRank.map(([t, v]) => (
                <tr key={t} style={rowClickable} onClick={() => openType(t)}>
                  <td style={td}>{t}</td><td style={td}>{v.count}건</td><td style={td}>{won(v.sales)}</td>
                  <td style={td}>{agg.totalSales ? Math.round(v.sales / agg.totalSales * 100) : 0}% <span style={{ color: '#c8a900' }}>›</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 자재마이닝 */}
      <div style={box}>
        <div style={{ fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>📦 자재 소요량 (판매수량 × 레시피)</div>
        {ingredients === null ? (
          <div style={{ color: '#888', fontSize: 13, lineHeight: 1.7 }}>
            레시피 테이블(menu_ingredients)이 아직 없습니다.<br />
            backend/supabase/migrations/012_menu_ingredients.sql 실행 후 메뉴별 레시피를 등록하면 여기에 자동 집계됩니다.
          </div>
        ) : ingredients.length === 0 ? (
          <div style={{ color: '#888', fontSize: 13 }}>등록된 레시피가 없습니다. menu_ingredients에 메뉴별 자재를 등록해주세요.</div>
        ) : agg.materials.length === 0 ? (
          <div style={{ color: '#666', fontSize: 13 }}>이 기간에 레시피가 등록된 메뉴의 판매 내역이 없습니다.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>자재</th><th style={th}>총 소요량</th></tr></thead>
            <tbody>
              {agg.materials.map(m => (
                <tr key={m.name + m.unit}><td style={td}>{m.name}</td><td style={td}>{Number(m.amount.toFixed(2)).toLocaleString()} {m.unit}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ===== F-3: 제출용 리포트 ===== */}
      <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, color: '#f0f0f0' }}>📄 제출용 리포트</div>
        <span style={{ fontSize: 12, color: '#888' }}>위에서 선택한 기간({range.label})의 전체 항목이 자동 반영됩니다</span>
        <span style={{ flex: 1 }} />
        <button onClick={downloadExcel} style={{
          padding: '10px 16px', background: '#1d6f42', color: '#fff', fontWeight: 700,
          fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer',
        }}>📊 엑셀 다운로드</button>
        <button onClick={openPdfReport} style={{
          padding: '10px 16px', background: '#b91c1c', color: '#fff', fontWeight: 700,
          fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer',
        }}>🖨️ PDF 보고서 열기</button>
      </div>

      {/* ===== F-2: 고객관리 통계 ===== */}
      <div style={{ fontWeight: 900, color: '#c8a900', fontSize: 15, margin: '20px 0 10px' }}>👥 고객관리</div>

      {/* 신규/재방문 (선택한 기간 기준) — 카드 탭 시 회원 명단 + 알림 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ ...box, flex: 1, marginBottom: 0, textAlign: 'center', ...rowClickable }} onClick={() => openMembers('🆕 신규 가입 회원', crm.newList)}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>신규 가입 (기간 내) ›</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#FFD700' }}>{crm.newMembers}명</div>
        </div>
        <div style={{ ...box, flex: 1, marginBottom: 0, textAlign: 'center', ...rowClickable }} onClick={() => openMembers('🙋 방문 회원', crm.visitorList)}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>방문 회원 (기간 내) ›</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#FFD700' }}>{crm.visitors}명</div>
        </div>
        <div style={{ ...box, flex: 1, marginBottom: 0, textAlign: 'center', ...rowClickable }} onClick={() => openMembers('💛 재방문 회원', crm.revisitList)}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>재방문 회원 ›</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#FFD700' }}>{crm.revisit}명 <span style={{ fontSize: 13, color: '#888' }}>({crm.revisitRate}%)</span></div>
        </div>
      </div>

      {/* 마케팅 동의 + 상태 분포 (전체 회원 기준) */}
      <div style={{ ...box, ...rowClickable }} onClick={() => openMembers('📣 마케팅 수신동의 회원', crm.optInList)}>
        <div style={{ fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>📣 마케팅 수신동의 (전체 회원 기준) <span style={{ fontSize: 11, color: '#c8a900', fontWeight: 400 }}>· 명단 보기 ›</span></div>
        <div style={{ fontSize: 14, color: '#ccc' }}>
          동의 {crm.optIn}명 / 전체 {crm.total}명
          {' '}<span style={{ color: '#FFD700', fontWeight: 700 }}>({crm.total ? Math.round(crm.optIn / crm.total * 100) : 0}%)</span>
        </div>
      </div>

      <div style={box}>
        <div style={{ fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>🪪 회원 상태별 분포 <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>· 행을 누르면 명단</span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>상태</th><th style={th}>인원</th><th style={th}></th></tr></thead>
          <tbody>
            <tr style={rowClickable} onClick={() => openMembers('🪪 전화번호만 가입', crm.statusLists.phone_member)}><td style={td}>전화번호만 가입 (phone_member)</td><td style={td}>{crm.statusDist.phone_member || 0}명</td><td style={{ ...td, color: '#c8a900' }}>›</td></tr>
            <tr style={rowClickable} onClick={() => openMembers('🪪 추가정보 일부', crm.statusLists.profile_incomplete)}><td style={td}>추가정보 일부 (profile_incomplete)</td><td style={td}>{crm.statusDist.profile_incomplete || 0}명</td><td style={{ ...td, color: '#c8a900' }}>›</td></tr>
            <tr style={rowClickable} onClick={() => openMembers('🪪 추가정보 완료', crm.statusLists.profile_complete)}><td style={td}>추가정보 완료 (profile_complete)</td><td style={td}>{crm.statusDist.profile_complete || 0}명</td><td style={{ ...td, color: '#c8a900' }}>›</td></tr>
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>* guest(비회원)는 가입 기록이 없어 인원 산정 불가 — 비회원 주문은 매출 통계에 포함됨</div>
      </div>

      {/* 휴면 구간 (CRM 트리거 기준: 10일 / 45~60일) — 행 탭 시 명단 + 알림(재방문 유도) */}
      <div style={box}>
        <div style={{ fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>💤 휴면고객 (마지막 주문 기준) <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>· 행을 누르면 명단·알림</span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>구간</th><th style={th}>인원</th><th style={th}></th></tr></thead>
          <tbody>
            <tr style={rowClickable} onClick={() => openMembers('💤 활성 (10일 미만)', crm.dormantLists.active)}><td style={td}>활성 (10일 미만)</td><td style={td}>{crm.dormant.active}명</td><td style={{ ...td, color: '#c8a900' }}>›</td></tr>
            <tr style={rowClickable} onClick={() => openMembers('💤 10~44일 미방문', crm.dormantLists.d10)}><td style={td}>10~44일 미방문</td><td style={td}>{crm.dormant.d10}명</td><td style={{ ...td, color: '#c8a900' }}>›</td></tr>
            <tr style={rowClickable} onClick={() => openMembers('💤 45~60일 미방문', crm.dormantLists.d45)}><td style={td}>45~60일 미방문</td><td style={td}>{crm.dormant.d45}명</td><td style={{ ...td, color: '#c8a900' }}>›</td></tr>
            <tr style={rowClickable} onClick={() => openMembers('💤 60일 초과 미방문', crm.dormantLists.d60)}><td style={td}>60일 초과 미방문</td><td style={td}>{crm.dormant.d60}명</td><td style={{ ...td, color: '#c8a900' }}>›</td></tr>
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>* 주문 이력이 없는 회원은 가입일 기준으로 계산</div>
      </div>
      </>
      )}

      <CouponStats />
    </div>
  )
}
