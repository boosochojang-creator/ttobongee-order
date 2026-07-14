import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { id, is_available, sold_out } = await req.json()
    if (id === undefined) {
      return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
    }
    // [3] sold_out(재료 소진)이 오면 그 값으로 설정, 아니면 기존 is_available 토글(현재값을 받아 반전)
    let patch: { is_available?: boolean; sold_out?: boolean }
    if (sold_out !== undefined) patch = { sold_out: !!sold_out }
    else if (is_available !== undefined) patch = { is_available: !is_available }
    else return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error } = await admin.from('menus').update(patch).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
