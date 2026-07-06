import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runCouponAutomation } from '../../../lib/coupons'

// Phase 4-B: 쿠폰 자동발급 실행 (영업시작 시 호출). 서비스롤 — 만료전환 + 조건발급 + 오늘 발급분 반환.
export async function POST() {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const r = await runCouponAutomation(admin)
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
