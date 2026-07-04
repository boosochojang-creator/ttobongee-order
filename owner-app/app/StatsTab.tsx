'use client'

// 그룹 F-1: 매출/메뉴/테이블/주문유형 통계 + 자재마이닝 (정부 지원금·본사 보고용)
// 날짜 경계는 매장 운영시간 기준(KST, UTC+9)으로 명시적으로 고정한다 — UTC/KST 혼동 방지.
// 집계 대상: canceled / pending / verification_failed 제외 (금액이 확정되지 않은 주문 제외)
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

type Period = 'day' | 'week' | 'month' | 'quarter' | 'year'

type OrderRow = {
  id: string
  table_no: number
  order_type: string
  status: string
  final_amount: number
  created_at: string
  order_items: { menu_id: string | null; name_snapshot: string; qty: number; subtotal: number }[]
}

type Ingredient = { menu_id: string; ingredient_name: string; amount_per_serving: number; unit: string }

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

const ORDER_TYPE_LABEL: Record<string, string> = { dine_in: '매장식사', takeout: '포장' }
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
      .select('id, table_no, order_type, status, final_amount, created_at, order_items(menu_id, name_snapshot, qty, subtotal)')
      .eq('store_id', 'baegun')
      .gte('created_at', new Date(range.start).toISOString())
      .lt('created_at', new Date(range.end).toISOString())
      .not('status', 'in', '(canceled,pending,verification_failed)')
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

  const agg = useMemo(() => {
    const totalSales = orders.reduce((s, o) => s + (o.final_amount || 0), 0)
    const count = orders.length

    const byMenu = new Map<string, { qty: number; sales: number; menuId: string | null }>()
    const byTable = new Map<string, { count: number; sales: number }>()
    const byType = new Map<string, { count: number; sales: number }>()

    for (const o of orders) {
      const tKey = o.order_type === 'takeout' ? '포장' : `${o.table_no}번`
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

  return (
    <div style={{ padding: '0 4px' }}>
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

      {/* 테이블별 */}
      <div style={box}>
        <div style={{ fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>🪑 테이블별</div>
        {agg.tableRank.length === 0 ? <div style={{ color: '#666', fontSize: 13 }}>내역 없음</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>테이블</th><th style={th}>주문 건수</th><th style={th}>매출액</th></tr></thead>
            <tbody>
              {agg.tableRank.map(([t, v]) => (
                <tr key={t}><td style={td}>{t}</td><td style={td}>{v.count}건</td><td style={td}>{won(v.sales)}</td></tr>
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
                <tr key={t}>
                  <td style={td}>{t}</td><td style={td}>{v.count}건</td><td style={td}>{won(v.sales)}</td>
                  <td style={td}>{agg.totalSales ? Math.round(v.sales / agg.totalSales * 100) : 0}%</td>
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
      </>
      )}
    </div>
  )
}
