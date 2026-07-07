import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { purgePostImages } from '../../../../lib/purgePostImages'

// Phase 5-2-e-2: 90일 지난 비밀글 사진 자동삭제 (vercel.json 크론 daily). 텍스트는 유지.
export async function GET() {
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const r = await purgePostImages(admin, 90)
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
