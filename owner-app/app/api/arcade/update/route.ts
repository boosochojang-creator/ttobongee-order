import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Phase 5-2-c-1: 오락실 게임 관리 (온/오프·이름·순서). 서비스롤.
export async function POST(req: NextRequest) {
  try {
    const { id, name, is_active, sort_order } = await req.json()
    if (!id) return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
    const patch: Record<string, any> = {}
    if (typeof name === 'string') patch.name = name.trim().slice(0, 20)
    if (typeof is_active === 'boolean') patch.is_active = is_active
    if (typeof sort_order === 'number') patch.sort_order = sort_order
    if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: '변경 항목 없음' }, { status: 400 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error } = await admin.from('arcade_games').update(patch).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
