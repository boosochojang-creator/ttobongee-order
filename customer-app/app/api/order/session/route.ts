import { NextRequest, NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { adminClient } from '../../../lib/supabaseAdmin'

// [그룹5·주문누적] 결제 전까지의 '이번 방문' 진행 주문(회차)을 누적으로 반환.
//   회원 본인(user_id) 기준 · 오늘(KST) · 아직 정산/취소 안 된(served·canceled 제외) 주문만.
//   점주가 결제처리(close-session → status=served)하면 여기서 자동 제외 → 고객 화면 '종'도 사라짐.
//   (테이블 식별과 별개로 user_id로 묶어, 테이블번호 잔존/오인식 영향 없이 '내 주문'만 정확히 누적.)
export const dynamic = 'force-dynamic'
export const revalidate = 0

const OPEN_STATUSES = ['pending', 'paid', 'cash_pending', 'accepted', 'cooking', 'done']

export async function GET(req: NextRequest) {
  noStore()
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    const sid = req.nextUrl.searchParams.get('storeId') || 'baegun'
    if (!userId) return NextResponse.json({ ok: true, rounds: [], total: 0, count: 0 })

    const admin = adminClient()
    // 오늘(KST) 00:00 이후 — close-session의 세션 마감 기준과 동일
    const todayKst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
    const { data } = await admin.from('orders')
      .select('id, status, order_type, table_no, final_amount, free_gifts, created_at, order_items(name_snapshot, qty)')
      .eq('store_id', sid)
      .eq('user_id', userId)
      .in('status', OPEN_STATUSES)
      .gte('created_at', `${todayKst}T00:00:00+09:00`)
      .order('created_at', { ascending: true })

    const rounds = (data || []).map((o: any, i: number) => ({
      id: o.id,
      round: i + 1,
      status: o.status,
      orderType: o.order_type,
      tableNo: o.table_no,
      amount: o.final_amount || 0,
      items: (o.order_items || []).map((it: any) => ({ name: it.name_snapshot, qty: it.qty })),
      gifts: Array.isArray(o.free_gifts) ? o.free_gifts.map((g: any) => ({ name: g.menu, qty: g.qty || 1 })) : [],
      createdAt: o.created_at,
    }))
    const total = rounds.reduce((s: number, r: any) => s + r.amount, 0)
    return NextResponse.json({ ok: true, rounds, total, count: rounds.length })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
