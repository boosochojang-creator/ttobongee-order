import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Phase 5-2-c-1: 오락실 게임 관리 (온/오프·이름·순서 + 업로드 게임 생성/삭제). 서비스롤.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // 신규 업로드 게임 등록 (브라우저가 games 버킷에 HTML 직접 업로드 후 URL만 전달)
    if (body.action === 'create') {
      const name = String(body.name || '').trim().slice(0, 20)
      const storage_url = String(body.storage_url || '')
      if (!name) return NextResponse.json({ ok: false, error: '게임 이름을 입력해주세요' }, { status: 400 })
      if (!storage_url) return NextResponse.json({ ok: false, error: '업로드 URL 누락' }, { status: 400 })
      const file_key = (storage_url.split('/').pop() || '').replace(/\.html$/i, '') // arcade_games.file_key NOT NULL 충족용
      const { data: last } = await admin.from('arcade_games').select('sort_order').eq('store_id', 'baegun').order('sort_order', { ascending: false }).limit(1)
      const nextOrder = (last?.[0]?.sort_order || 0) + 1
      const { error } = await admin.from('arcade_games').insert({ store_id: 'baegun', name, file_key, storage_url, is_active: true, sort_order: nextOrder })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // 게임 삭제 (업로드 게임은 스토리지 파일도 함께 제거)
    if (body.action === 'delete') {
      if (!body.id) return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
      const { data: g } = await admin.from('arcade_games').select('storage_url').eq('id', body.id).single()
      const url: string | null = g?.storage_url || null
      if (url) { try { await admin.storage.from('games').remove([url.split('/games/').pop() || '']) } catch {} }
      const { error } = await admin.from('arcade_games').delete().eq('id', body.id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // 기존: 이름/노출/순서 수정
    const { id, name, is_active, sort_order } = body
    if (!id) return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
    const patch: Record<string, any> = {}
    if (typeof name === 'string') patch.name = name.trim().slice(0, 20)
    if (typeof is_active === 'boolean') patch.is_active = is_active
    if (typeof sort_order === 'number') patch.sort_order = sort_order
    if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: '변경 항목 없음' }, { status: 400 })

    const { error } = await admin.from('arcade_games').update(patch).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
