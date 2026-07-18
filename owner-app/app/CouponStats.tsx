'use client'
// Phase 4-B-6: 쿠폰 성과 통계 (정부지원 보고자료용). 전부 read-time 계산 — 새 저장 없음.
// 집계: 종류별 발급/사용/사용률/미사용(만료포함), 쿠폰사용 매출, 발급 후 7일·30일 내 재주문(발급 건 기준).
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { STORE_ID } from './lib/store'

const COUNTED = ['paid', 'accepted', 'cooking', 'done', 'served', 'out_for_delivery', 'delivered']
const TYPES = ['signup', 'birthday', 'winback', 'vip_thanks'] as const
const TYPE_LABEL: Record<string, string> = { signup: '신규가입', birthday: '생일', winback: '재방문', vip_thanks: '단골감사' }
const won = (n: number) => (n || 0).toLocaleString() + '원'

type Coupon = { type: string; status: string; issued_at: string; used_order_id: string | null; user_id: string }
type Ord = { id: string; user_id: string | null; created_at: string; final_amount: number; status: string }

const box: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }
const th: React.CSSProperties = { textAlign: 'right', padding: '6px 8px', color: '#c8a900', fontSize: 12, borderBottom: '1px solid #333', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { textAlign: 'right', padding: '6px 8px', color: '#ccc', fontSize: 13, borderBottom: '1px solid #222', whiteSpace: 'nowrap' }
const tdL: React.CSSProperties = { ...td, textAlign: 'left', color: '#eee', fontWeight: 700 }

export default function CouponStats() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null)
  const [orders, setOrders] = useState<Ord[]>([])

  useEffect(() => {
    // 멀티매장: 이 매장(STORE_ID) 회원·주문으로 스코핑. coupons는 store_id가 없어 store 회원(user_id) 경유.
    ;(async () => {
      const { data: us } = await supabase.from('users').select('id').eq('store_id', STORE_ID)
      const storeUserIds = (us || []).map(u => u.id)
      const { data: cp } = await supabase.from('coupons').select('type, status, issued_at, used_order_id, user_id').in('user_id', storeUserIds)
      setCoupons((cp as Coupon[]) || [])
      const { data: od } = await supabase.from('orders').select('id, user_id, created_at, final_amount, status').eq('store_id', STORE_ID)
      setOrders((od as Ord[]) || [])
    })()
  }, [])

  if (!coupons) return <div style={box}><div style={{ color: '#888', fontSize: 13 }}>쿠폰 성과 불러오는 중…</div></div>

  const orderById = new Map(orders.map(o => [o.id, o]))
  const ordersByUser: Record<string, Ord[]> = {}
  for (const o of orders) {
    if (!o.user_id || !COUNTED.includes(o.status)) continue
    ;(ordersByUser[o.user_id] ||= []).push(o)
  }
  const reorderWithin = (c: Coupon, days: number) => {
    const t0 = new Date(c.issued_at).getTime()
    const end = t0 + days * 86400000
    return (ordersByUser[c.user_id] || []).some(o => {
      const ot = new Date(o.created_at).getTime(); return ot > t0 && ot <= end
    })
  }

  const row = (t: string) => {
    const list = coupons.filter(c => c.type === t)
    const issued = list.length
    const used = list.filter(c => c.status === 'used').length
    const unused = issued - used // active + expired
    const revenue = list.filter(c => c.used_order_id).reduce((s, c) => s + (orderById.get(c.used_order_id!)?.final_amount || 0), 0)
    const re7 = list.filter(c => reorderWithin(c, 7)).length
    const re30 = list.filter(c => reorderWithin(c, 30)).length
    return { issued, used, unused, rate: issued ? Math.round((used / issued) * 1000) / 10 : 0, revenue, re7, re30 }
  }
  const rows = TYPES.map(t => ({ t, ...row(t) }))
  const tot = rows.reduce((a, r) => ({
    issued: a.issued + r.issued, used: a.used + r.used, unused: a.unused + r.unused,
    revenue: a.revenue + r.revenue, re7: a.re7 + r.re7, re30: a.re30 + r.re30,
  }), { issued: 0, used: 0, unused: 0, revenue: 0, re7: 0, re30: 0 })
  const totRate = tot.issued ? Math.round((tot.used / tot.issued) * 1000) / 10 : 0

  return (
    <div style={box}>
      <div style={{ fontWeight: 700, color: '#f0f0f0', marginBottom: 4 }}>🎟️ 쿠폰 성과 (누적)</div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>발급·사용·재주문·매출 — 조회 시점 집계 (정부지원 보고자료 근거용)</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>종류</th>
              <th style={th}>발급</th><th style={th}>사용</th><th style={th}>사용률</th>
              <th style={th}>미사용</th><th style={th}>사용매출</th><th style={th}>7일재주문</th><th style={th}>30일재주문</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.t}>
                <td style={tdL}>{TYPE_LABEL[r.t]}</td>
                <td style={td}>{r.issued}</td><td style={td}>{r.used}</td><td style={td}>{r.rate}%</td>
                <td style={td}>{r.unused}</td><td style={td}>{won(r.revenue)}</td><td style={td}>{r.re7}</td><td style={td}>{r.re30}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...tdL, color: '#c8a900' }}>합계</td>
              <td style={{ ...td, color: '#f0f0f0', fontWeight: 700 }}>{tot.issued}</td>
              <td style={{ ...td, color: '#f0f0f0', fontWeight: 700 }}>{tot.used}</td>
              <td style={{ ...td, color: '#f0f0f0', fontWeight: 700 }}>{totRate}%</td>
              <td style={{ ...td, color: '#f0f0f0', fontWeight: 700 }}>{tot.unused}</td>
              <td style={{ ...td, color: '#c8a900', fontWeight: 700 }}>{won(tot.revenue)}</td>
              <td style={{ ...td, color: '#f0f0f0', fontWeight: 700 }}>{tot.re7}</td>
              <td style={{ ...td, color: '#f0f0f0', fontWeight: 700 }}>{tot.re30}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#666', marginTop: 8 }}>
        * 미사용 = 미사용·만료 포함 (발급−사용). 사용매출 = 쿠폰 적용된 주문 결제금액 합. 재주문 = 발급 후 해당 기간 내 그 회원의 완료주문이 있는 발급 건 수.
      </div>
    </div>
  )
}
