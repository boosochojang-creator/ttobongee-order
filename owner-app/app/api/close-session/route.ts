import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recomputeCustomer } from '../../lib/customerStats'
import { STORE_ID } from '../../lib/store'

// A2: 한 테이블의 결제완료(세션 마감). 그 테이블의 조리완료(done) 매장주문을 한 번에 served로 닫고,
// 같은 closed_at(하나의 결제 시점)을 공유시켜 '방문 1회'로 집계되게 한다.
export async function POST(req: NextRequest) {
  try {
    const { table_no } = await req.json()
    if (table_no === undefined || table_no === null) {
      return NextResponse.json({ ok: false, error: 'table_no 필요' }, { status: 400 })
    }
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 오늘(KST) 그 테이블의 조리완료된 매장주문만 대상 (진행중/이미 마감 제외)
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
    const { data: targets } = await admin.from('orders')
      .select('id, user_id')
      .eq('store_id', STORE_ID)
      .eq('order_type', 'dine_in')
      .eq('table_no', table_no)
      .eq('status', 'done')
      .gte('created_at', `${today}T00:00:00+09:00`)
    const ids = (targets || []).map(o => o.id)
    if (!ids.length) return NextResponse.json({ ok: true, closed: 0 })

    const closedAt = new Date().toISOString()
    // 상태 마감(필수) — closed_at 없이 먼저 확정
    const { error } = await admin.from('orders').update({ status: 'served', updated_at: closedAt }).in('id', ids)
    if (error) throw error
    // closed_at 공유 기록(best-effort — 컬럼 미존재 시에도 마감은 유지). 방문 세션 집계의 핵심.
    try { await admin.from('orders').update({ closed_at: closedAt }).in('id', ids) } catch {}

    // 이 세션에 참여한 회원 CRM 재계산(방문/등급/누적)
    const userIds = Array.from(new Set((targets || []).map(o => o.user_id).filter(Boolean))) as string[]
    for (const uid of userIds) {
      try { await recomputeCustomer(admin, uid) } catch {}
    }

    return NextResponse.json({ ok: true, closed: ids.length })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
