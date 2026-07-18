import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { STORE_ID } from '../../../lib/store'

// Phase 5-2-d: 음악 업로드 (music 버킷) + music_tracks 등록. 서비스롤.
export async function POST(req: NextRequest) {
  try {
    // 신규: 브라우저가 스토리지에 직접 올린 뒤 URL만 등록(JSON). 4.5MB 함수 제한 우회.
    if ((req.headers.get('content-type') || '').includes('application/json')) {
      const { title, url } = await req.json()
      const t = String(title || '').trim().slice(0, 40)
      if (!t) return NextResponse.json({ ok: false, error: '제목을 입력해주세요' }, { status: 400 })
      if (!url || typeof url !== 'string') return NextResponse.json({ ok: false, error: '업로드 URL 누락' }, { status: 400 })
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const { data: last } = await admin.from('music_tracks').select('sort_order').eq('store_id', STORE_ID).order('sort_order', { ascending: false }).limit(1)
      const nextOrder = (last?.[0]?.sort_order || 0) + 1
      const { error } = await admin.from('music_tracks').insert({ store_id: STORE_ID, title: t, url, is_active: true, sort_order: nextOrder })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    const form = await req.formData()
    const file = form.get('file') as File | null
    const title = String(form.get('title') || '').trim().slice(0, 40)
    if (!file) return NextResponse.json({ ok: false, error: '파일 누락' }, { status: 400 })
    if (!title) return NextResponse.json({ ok: false, error: '제목을 입력해주세요' }, { status: 400 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const ext = (file.name.split('.').pop() || 'mp3').toLowerCase()
    const key = `${randomUUID()}.${ext}`
    const bytes = await file.arrayBuffer()

    const { error: upErr } = await admin.storage.from('music').upload(key, bytes, { contentType: file.type || 'audio/mpeg', upsert: false })
    if (upErr) throw upErr
    const { data: { publicUrl } } = admin.storage.from('music').getPublicUrl(key)

    // 다음 순서값
    const { data: last } = await admin.from('music_tracks').select('sort_order').eq('store_id', STORE_ID).order('sort_order', { ascending: false }).limit(1)
    const nextOrder = (last?.[0]?.sort_order || 0) + 1

    const { error: insErr } = await admin.from('music_tracks').insert({ store_id: STORE_ID, title, url: publicUrl, is_active: true, sort_order: nextOrder })
    if (insErr) throw insErr
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
