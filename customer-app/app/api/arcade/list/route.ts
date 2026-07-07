import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Phase 5-2-c-1: 손님 오락실 — 활성 게임 목록 (019 테이블은 RLS로 anon 직접읽기 차단 → 서비스롤 경유)
export async function GET() {
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await admin.from('arcade_games')
      .select('id, name, file_key').eq('store_id', 'baegun').eq('is_active', true).order('sort_order')
    return NextResponse.json({ ok: true, games: data || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
