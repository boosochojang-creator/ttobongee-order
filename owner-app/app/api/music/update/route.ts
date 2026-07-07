import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Phase 5-2-d: 음악 관리 (제목·노출·순서·삭제). 서비스롤. 삭제 시 스토리지 파일도 제거.
export async function POST(req: NextRequest) {
  try {
    const { id, action, title, is_active, sort_order } = await req.json()
    if (!id) return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    if (action === 'delete') {
      const { data: t } = await admin.from('music_tracks').select('url').eq('id', id).single()
      if (t?.url) {
        const key = t.url.split('/music/').pop()
        if (key) await admin.storage.from('music').remove([decodeURIComponent(key)]).catch(() => {})
      }
      const { error } = await admin.from('music_tracks').delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    const patch: Record<string, any> = {}
    if (typeof title === 'string') patch.title = title.trim().slice(0, 40)
    if (typeof is_active === 'boolean') patch.is_active = is_active
    if (typeof sort_order === 'number') patch.sort_order = sort_order
    if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: '변경 항목 없음' }, { status: 400 })

    const { error } = await admin.from('music_tracks').update(patch).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
