import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// [2] 영업상태 — 영업시작/마감 시 stores.is_open 갱신 (service role: stores UPDATE는 anon 차단).
// 마이그레이션(stores.is_open) 전에는 update가 실패하지만, 호출측은 fire-and-forget이라 영업 흐름을 막지 않는다.
export async function POST(req: NextRequest) {
  try {
    const { open } = await req.json()
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error } = await admin.from('stores').update({ is_open: !!open }).eq('id', 'baegun')
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
