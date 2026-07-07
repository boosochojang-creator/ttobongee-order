import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkContent, generateNickname } from '../../../../lib/contentFilter'

// Phase 5-2-c-2: 댓글 (3곳 글 모두 가능). 서비스롤 + 필터 + 익명/닉네임.
function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: NextRequest) {
  try {
    const postId = req.nextUrl.searchParams.get('postId')
    if (!postId) return NextResponse.json({ ok: false, error: 'postId 필요' }, { status: 400 })
    const db = admin()
    const { data } = await db.from('comments')
      .select('id, author_name, content, created_at').eq('post_id', postId)
      .order('created_at', { ascending: true })
    return NextResponse.json({ ok: true, comments: data || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.postId) return NextResponse.json({ ok: false, error: 'postId 필요' }, { status: 400 })
    const content = (b.content || '').trim()
    const chk = checkContent(content)
    if (!chk.ok) return NextResponse.json({ ok: false, error: chk.reason }, { status: 400 })

    const db = admin()
    const anonymous = !!b.anonymous
    let authorName = '익명'
    if (!anonymous) {
      if (b.userId) {
        const { data: u } = await db.from('users').select('nickname').eq('id', b.userId).single()
        let nk = (u?.nickname || '').trim()
        if (!nk) { nk = generateNickname(); await db.from('users').update({ nickname: nk }).eq('id', b.userId) }
        authorName = nk
      } else {
        authorName = generateNickname()
      }
    }
    const { error } = await db.from('comments').insert({
      post_id: b.postId, user_id: b.userId || null,
      author_name: authorName, is_anonymous: anonymous, content,
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
