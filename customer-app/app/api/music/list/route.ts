import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

// Phase 5-2-d: 손님 음악감상실 — 활성 트랙 목록 (서비스롤, RLS 우회)
// 정적 캐시 금지 — 오너가 올린 곡·on/off가 재배포 없이 즉시 반영되도록.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  noStore()
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await admin.from('music_tracks')
      .select('id, title, url').eq('store_id', 'baegun').eq('is_active', true).order('sort_order')
    return NextResponse.json({ ok: true, tracks: data || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
