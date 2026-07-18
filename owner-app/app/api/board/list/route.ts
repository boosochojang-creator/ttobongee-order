import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { STORE_ID } from '../../../lib/store'

// Phase 5-2-e-2: 오너 게시글 통합조회 — 3곳(source) 한곳에서. 비밀글 내용도 점주는 비번 없이 열람(서비스롤).
export async function GET(req: NextRequest) {
  try {
    const source = req.nextUrl.searchParams.get('source') || 'all'
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    let q = admin.from('posts')
      .select('id, source, author_name, is_anonymous, is_secret, content, image_url, created_at')
      .eq('store_id', STORE_ID).order('created_at', { ascending: false }).limit(200)
    if (source !== 'all') q = q.eq('source', source)
    const { data: posts } = await q

    const ids = (posts || []).map(p => p.id)
    const counts: Record<string, number> = {}
    if (ids.length) {
      const { data: cs } = await admin.from('comments').select('post_id').in('post_id', ids)
      for (const c of cs || []) counts[c.post_id] = (counts[c.post_id] || 0) + 1
    }
    const list = await Promise.all((posts || []).map(async p => {
      let imageUrl: string | null = null
      if (p.image_url) {
        const { data } = await admin.storage.from('post-images').createSignedUrl(p.image_url, 600)
        imageUrl = data?.signedUrl || null
      }
      return { id: p.id, source: p.source, author_name: p.author_name, is_secret: p.is_secret, content: p.content, image_url: imageUrl, created_at: p.created_at, comment_count: counts[p.id] || 0 }
    }))
    return NextResponse.json({ ok: true, posts: list })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
