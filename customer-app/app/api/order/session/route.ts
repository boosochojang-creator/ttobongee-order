import { NextRequest, NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { adminClient } from '../../../lib/supabaseAdmin'

// [테이블 공유 탭] 결제 전까지의 '이번 방문' 진행 주문(회차)을 누적으로 반환.
//   ▸ dine_in 착석(table_no>0): 그 테이블의 미결제 주문 전체(주문자 무관)를 합산 = 일행 A·B가 한 탭으로 보임.
//   ▸ 그 외(포장·table_no 없음/0): 회원 본인(user_id) 기준 폴백 — 테이블 개념 없음, 오인식 방지.
//   점주가 결제처리(close-session → served)하면 여기서 자동 제외 → 고객 화면 종도 사라짐.
//   오늘(KST) + open 상태만. 지난 세션은 served라 자동 제외(closed_at 경계).
export const dynamic = 'force-dynamic'
export const revalidate = 0

const OPEN_STATUSES = ['pending', 'paid', 'cash_pending', 'accepted', 'cooking', 'done']

export async function GET(req: NextRequest) {
  noStore()
  try {
    const sp = req.nextUrl.searchParams
    const userId = sp.get('userId')
    const sid = sp.get('storeId') || 'baegun'
    const tableNoRaw = sp.get('tableNo')
    const tableNo = tableNoRaw != null ? parseInt(tableNoRaw, 10) : NaN
    // dine_in 착석(유효 테이블)이면 테이블 공유 탭, 아니면 user_id 폴백
    const shared = Number.isInteger(tableNo) && tableNo > 0

    if (!userId && !shared) return NextResponse.json({ ok: true, rounds: [], total: 0, count: 0, shared: false })

    const admin = adminClient()
    const todayKst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

    let query = admin.from('orders')
      .select('id, status, order_type, table_no, user_id, final_amount, free_gifts, created_at, order_items(name_snapshot, qty)')
      .eq('store_id', sid)
      .in('status', OPEN_STATUSES)
      .gte('created_at', `${todayKst}T00:00:00+09:00`)
      .order('created_at', { ascending: true })

    if (shared) {
      // 같은 테이블 세션: 매장(dine_in) + 그 테이블에서 발생한 포장(takeout, table_no=N) 함께 (close-session 마감 기준과 동일)
      query = query.eq('table_no', tableNo).in('order_type', ['dine_in', 'takeout'])
    } else {
      query = query.eq('user_id', userId as string)
    }

    const { data } = await query

    const rounds = (data || []).map((o: any, i: number) => ({
      id: o.id,
      round: i + 1,
      status: o.status,
      orderType: o.order_type,
      tableNo: o.table_no,
      userId: o.user_id, // 공유 탭에서 '내 주문 여부' 판별용(팝업 노출 조건)
      amount: o.final_amount || 0,
      items: (o.order_items || []).map((it: any) => ({ name: it.name_snapshot, qty: it.qty })),
      gifts: Array.isArray(o.free_gifts) ? o.free_gifts.map((g: any) => ({ name: g.menu, qty: g.qty || 1 })) : [],
      createdAt: o.created_at,
    }))
    const total = rounds.reduce((s: number, r: any) => s + r.amount, 0)
    return NextResponse.json({ ok: true, rounds, total, count: rounds.length, shared })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
