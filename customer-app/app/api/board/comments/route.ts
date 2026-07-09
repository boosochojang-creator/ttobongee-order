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
    const viewerId = req.nextUrl.searchParams.get('userId') // [8] 본인 댓글 판정
    if (!postId) return NextResponse.json({ ok: false, error: 'postId 필요' }, { status: 400 })
    const db = admin()
    const { data } = await db.from('comments')
      .select('id, user_id, author_name, content, created_at').eq('post_id', postId)
      .order('created_at', { ascending: true })
    const comments = (data || []).map(c => ({
      id: c.id, author_name: c.author_name, content: c.content, created_at: c.created_at,
      is_mine: !!(viewerId && c.user_id === viewerId),
    }))
    return NextResponse.json({ ok: true, comments })
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

// [8] 본인 댓글 수정
export async function PATCH(req: NextRequest) {
  try {
    const { commentId, userId, content } = await req.json()
    if (!commentId || !userId) return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 })
    const c = (content || '').trim()
    const chk = checkContent(c)
    if (!chk.ok) return NextResponse.json({ ok: false, error: chk.reason }, { status: 400 })
    const db = admin()
    const { data: cm } = await db.from('comments').select('user_id').eq('id', commentId).single()
    if (!cm) return NextResponse.json({ ok: false, error: '댓글을 찾을 수 없어요' }, { status: 404 })
    if (!cm.user_id || cm.user_id !== userId) return NextResponse.json({ ok: false, error: '본인 댓글만 수정할 수 있어요' }, { status: 403 })
    const { error } = await db.from('comments').update({ content: c }).eq('id', commentId).eq('user_id', userId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// [8] 본인 댓글 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { commentId, userId } = await req.json()
    if (!commentId || !userId) return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 })
    const db = admin()
    const { data: cm } = await db.from('comments').select('user_id').eq('id', commentId).single()
    if (!cm) return NextResponse.json({ ok: false, error: '댓글을 찾을 수 없어요' }, { status: 404 })
    if (!cm.user_id || cm.user_id !== userId) return NextResponse.json({ ok: false, error: '본인 댓글만 삭제할 수 있어요' }, { status: 403 })
    const { error } = await db.from('comments').delete().eq('id', commentId).eq('user_id', userId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
