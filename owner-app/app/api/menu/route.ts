import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { STORE_ID } from '../../lib/store'

// B3: 메뉴 생성/수정/삭제 — menus는 anon write가 RLS로 차단되므로 서비스롤 경유(토글과 동일 패턴).
// (기존 saveEdit/addMenu/deleteMenu가 anon 직접 write라 조용히 실패하던 버그 수정)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body?.action
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (action === 'create') {
      const name = String(body.name || '').trim()
      const price = parseInt(body.price)
      const category = String(body.category || '').trim()
      if (!name || !Number.isFinite(price) || price < 0) {
        return NextResponse.json({ ok: false, error: '이름/가격을 확인해주세요' }, { status: 400 })
      }
      const { error } = await admin.from('menus').insert({
        store_id: STORE_ID, category, name, price, sort_order: 999, is_available: true,
      })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'update') {
      const id = body.id
      if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 })
      const patch: Record<string, any> = {}
      if (body.name !== undefined) patch.name = String(body.name).trim()
      if (body.price !== undefined) {
        const p = parseInt(body.price)
        if (!Number.isFinite(p) || p < 0) return NextResponse.json({ ok: false, error: '가격을 확인해주세요' }, { status: 400 })
        patch.price = p
      }
      if (body.category !== undefined) patch.category = String(body.category).trim()
      if (body.image_url !== undefined) patch.image_url = body.image_url
      if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: '변경할 내용 없음' }, { status: 400 })
      const { error } = await admin.from('menus').update(patch).eq('id', id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'delete') {
      const id = body.id
      if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 })
      const { error } = await admin.from('menus').delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: '알 수 없는 action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
