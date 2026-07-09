import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Phase 5-2-e-2: 오너 — 특정 글의 댓글 조회
export async function GET(req: NextRequest) {
  try {
    const postId = req.nextUrl.searchParams.get('postId')
    if (!postId) return NextResponse.json({ ok: false, error: 'postId 필요' }, { status: 400 })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await admin.from('comments')
      .select('id, author_name, content, created_at').eq('post_id', postId).order('created_at', { ascending: true })
    return NextResponse.json({ ok: true, comments: data || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// [6] 오너 답글 — 게시글/한마디에 사장님 명의로 댓글 작성 (표시명 '🍗 사장님'으로 구분)
export async function POST(req: NextRequest) {
  try {
    const { postId, content } = await req.json()
    if (!postId || !content?.trim()) return NextResponse.json({ ok: false, error: '내용을 입력해주세요' }, { status: 400 })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error } = await admin.from('comments').insert({
      post_id: postId,
      content: content.trim().slice(0, 500),
      author_name: '🍗 사장님',
      is_anonymous: false,
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
