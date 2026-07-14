import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

// Phase 5-2-c-1: 손님 오락실 — 활성 게임 목록 (019 테이블은 RLS로 anon 직접읽기 차단 → 서비스롤 경유)
// 항상 최신 DB 반영(정적 캐시 금지) — 게임 시드 추가·오너 on/off·이름수정이 재배포 없이 즉시 반영되도록.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  noStore()
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await admin.from('arcade_games')
      .select('*').eq('store_id', 'baegun').eq('is_active', true).order('sort_order')
    return NextResponse.json({ ok: true, games: data || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
