import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

// Phase 5-2-c-1: 오너 게임관리 — 전체 게임 목록 (서비스롤). 업로드·수정 즉시 반영 위해 정적 캐시 금지.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  noStore()
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await admin.from('arcade_games').select('*').eq('store_id', 'baegun').order('sort_order')
    return NextResponse.json({ ok: true, games: data || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
