import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { STORE_ID } from '../../../lib/store'

// Phase 5-2-d: 오너 음악 목록 (전체). 서비스롤. 업로드 즉시 반영 위해 정적 캐시 금지.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  noStore()
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await admin.from('music_tracks').select('*').eq('store_id', STORE_ID).order('sort_order')
    return NextResponse.json({ ok: true, tracks: data || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
