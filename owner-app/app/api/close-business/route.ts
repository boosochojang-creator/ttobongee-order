import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SALES_COUNTED } from '../../lib/salesStatus'
import { STORE_ID } from '../../lib/store'

// 확인1 후속: 영업 마감(수동 버튼 + 자동 안전장치 공용 로직).
// 원칙: '열린 영업일'(start_time 있고 end_time null)을 타깃해 마감한다.
//  - 수동(manual): 점주가 버튼을 누른 시각으로 마감.
//  - 자동(auto): 매일 03:00(KST) 크론이 실행 — 그 시각까지의 매출을 전부 포함해 마감(예전 01:00 상한으로 01시 이후 매출이 빠지던 문제 수정).
// 처리 내용은 수동/자동 동일: ① daily_reports(end_time+매출집계) ② stores.is_open=false. (부분처리 금지)

async function performClose(auto: boolean) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 열린 영업일 탐지 (start 있고 end 없음).
  const { data: openRow } = await admin.from('daily_reports')
    .select('id, date, start_time, end_time')
    .eq('store_id', STORE_ID)
    .not('start_time', 'is', null)
    .is('end_time', null)
    .order('date', { ascending: false })
    .limit(1).maybeSingle()

  if (!openRow) {
    // 열린 영업일이 없으면 집계할 세션은 없지만, 마감 의사(수동/자동)는 is_open=false로 반영(과거 잔여 보정).
    try { await admin.from('stores').update({ is_open: false }).eq('id', STORE_ID) } catch {}
    return { ok: true, closed: false, reason: 'no_open_day' }
  }

  // 마감 시각·집계 상한 = 실제 마감 시각(수동=버튼 누른 때, 자동=03:00 실행 시각). 영업 중 들어온 주문은 자정 넘어도 전부 포함.
  const endIso = new Date().toISOString()

  // 해당 영업 세션 매출 집계 ([영업시작, 마감시각))
  const { data: raw } = await admin.from('orders')
    .select('final_amount, payment_method')
    .eq('store_id', STORE_ID)
    .in('status', SALES_COUNTED)
    .gte('created_at', openRow.start_time)
    .lt('created_at', endIso)
  const list = raw || []
  const total = list.reduce((s, o: any) => s + (o.final_amount || 0), 0)
  const byM = (m: string) => list.filter((o: any) => o.payment_method === m).reduce((s, o: any) => s + (o.final_amount || 0), 0)
  const count = list.length

  // ① daily_reports 마감 기록 (열린 그 행을 갱신)
  const { error: drErr } = await admin.from('daily_reports').update({
    end_time: endIso,
    total_sales: total, card_sales: byM('card'), cash_sales: byM('cash'),
    kakao_sales: byM('kakao'), toss_sales: byM('toss'),
    order_count: count, avg_order_value: count > 0 ? Math.round(total / count) : 0,
  }).eq('id', openRow.id)
  if (drErr) throw drErr

  // ② 고객 화면 마감 반영
  const { error: soErr } = await admin.from('stores').update({ is_open: false }).eq('id', STORE_ID)
  if (soErr) throw soErr

  // ③ [2026-10] 5번째 방문 쿠폰은 '그 영업일'만 유효 → 마감과 함께 미사용분 소멸(best-effort)
  try {
    const { data: su } = await admin.from('users').select('id').eq('store_id', STORE_ID)
    const ids = (su || []).map((u: any) => u.id)
    if (ids.length) await admin.from('coupons').update({ status: 'expired' })
      .eq('type', 'visit5').eq('status', 'active').in('user_id', ids)
  } catch {}

  return { ok: true, closed: true, date: openRow.date, auto, end_time: endIso, total_sales: total, order_count: count }
}

// 수동 마감: 점주앱에서 POST { auto:false }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    return NextResponse.json(await performClose(!!body?.auto))
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// 자동 마감: Vercel Cron(매일 03:00 KST = 18:00 UTC)이 GET으로 호출 → auto 처리
// CRON_SECRET 환경변수가 설정돼 있으면 Vercel이 Authorization 헤더를 붙여주므로 검증(외부 임의 호출 차단).
// (미설정 시에도 동작하도록 강제하지 않음 — 설정하면 자동 하드닝)
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await performClose(true))
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
