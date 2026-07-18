import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { checkContent, generateNickname } from '../../../../lib/contentFilter'
import { hashSecret } from '../../../../lib/secretPw'

// Phase 5-2-c-2: 통합 게시글 (source=music/arcade/board). 서비스롤 — RLS 차단 + 비밀글 가림 + 필터 처리.
// 비밀글/사진은 자유게시판(board) 전용 — 5-2-e에서 확장. 여기선 공개글 경로.
function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: NextRequest) {
  try {
    const source = req.nextUrl.searchParams.get('source')
    const viewerId = req.nextUrl.searchParams.get('userId') // [8] 본인 글 판정용
    if (!['music', 'arcade', 'board'].includes(source || '')) {
      return NextResponse.json({ ok: false, error: 'source 필요' }, { status: 400 })
    }
    const storeId = req.nextUrl.searchParams.get('storeId') || 'baegun'
    const db = admin()
    const { data: posts } = await db.from('posts')
      .select('id, user_id, author_name, is_anonymous, is_secret, content, image_url, created_at')
      .eq('store_id', storeId).eq('source', source)
      .order('created_at', { ascending: false }).limit(100)

    const ids = (posts || []).map(p => p.id)
    const counts: Record<string, number> = {}
    if (ids.length) {
      const { data: cs } = await db.from('comments').select('post_id').in('post_id', ids)
      for (const c of cs || []) counts[c.post_id] = (counts[c.post_id] || 0) + 1
    }
    // 비밀글은 목록에서 내용/사진 가림 (열람은 점주/작성자 비번). [9] 공개글 사진은 서명URL로 제공.
    const list = await Promise.all((posts || []).map(async p => {
      let publicImageUrl: string | null = null
      if (!p.is_secret && p.image_url) {
        const { data: signed } = await db.storage.from('post-images').createSignedUrl(p.image_url, 3600)
        publicImageUrl = signed?.signedUrl || null
      }
      return {
        id: p.id, author_name: p.author_name, created_at: p.created_at,
        is_secret: p.is_secret, comment_count: counts[p.id] || 0,
        content: p.is_secret ? null : p.content,
        has_image: !!p.image_url,
        image_url: publicImageUrl, // 공개글 사진(서명URL), 비밀글은 null
        is_mine: !!(viewerId && p.user_id === viewerId), // [8] 본인 글(회원)이면 수정/삭제 노출
      }
    }))
    return NextResponse.json({ ok: true, posts: list })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const source = b.source
    if (!['music', 'arcade', 'board'].includes(source)) {
      return NextResponse.json({ ok: false, error: 'source 오류' }, { status: 400 })
    }
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
        if (!nk) { nk = generateNickname(); await db.from('users').update({ nickname: nk }).eq('id', b.userId) } // 미설정 시 자동생성+프로필 저장
        authorName = nk
      } else {
        authorName = generateNickname() // 비회원 닉네임 = 1회성 자동생성
      }
    }
    // 비밀글·사진은 자유게시판(board) 전용
    const isSecret = source === 'board' && !!b.is_secret
    let secretHash: string | null = null
    if (isSecret) {
      const pw = String(b.secret_pw || '')
      if (pw.length < 2) return NextResponse.json({ ok: false, error: '비밀번호를 입력해주세요 (2자 이상)' }, { status: 400 })
      secretHash = hashSecret(pw)
    }
    // [9] 사진 첨부 — 자유게시판(board)이면 공개글/비밀글 모두 허용. 클라 압축 data URL → post-images 버킷.
    // (공개글 이미지는 GET에서 서명URL로 제공, 비밀글 이미지는 reveal에서 제공)
    let imageKey: string | null = null
    if (source === 'board' && typeof b.image === 'string' && b.image.startsWith('data:image/')) {
      const m = b.image.match(/^data:(image\/[\w+.-]+);base64,(.+)$/)
      if (m) {
        const ext = (m[1].split('/')[1] || 'jpg').replace('jpeg', 'jpg')
        const bytes = Buffer.from(m[2], 'base64')
        const key = `post-${randomUUID()}.${ext}`
        const { error: upErr } = await db.storage.from('post-images').upload(key, bytes, { contentType: m[1], upsert: false })
        if (!upErr) imageKey = key
      }
    }

    const { data, error } = await db.from('posts').insert({
      store_id: b.storeId || 'baegun', source, user_id: b.userId || null,
      author_name: authorName, is_anonymous: anonymous, content,
      is_secret: isSecret, secret_pw_hash: secretHash, image_url: imageKey,
    }).select('id').single()
    if (error) throw error
    return NextResponse.json({ ok: true, id: data.id })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// [8] 작성자 본인 글 수정 (내용). 소유권: user_id === 요청 userId (회원 글만).
export async function PATCH(req: NextRequest) {
  try {
    const { postId, userId, content } = await req.json()
    if (!postId || !userId) return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 })
    const c = (content || '').trim()
    const chk = checkContent(c)
    if (!chk.ok) return NextResponse.json({ ok: false, error: chk.reason }, { status: 400 })
    const db = admin()
    const { data: p } = await db.from('posts').select('user_id').eq('id', postId).single()
    if (!p) return NextResponse.json({ ok: false, error: '글을 찾을 수 없어요' }, { status: 404 })
    if (!p.user_id || p.user_id !== userId) return NextResponse.json({ ok: false, error: '본인 글만 수정할 수 있어요' }, { status: 403 })
    const { error } = await db.from('posts').update({ content: c }).eq('id', postId).eq('user_id', userId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// [8] 작성자 본인 글 삭제 (댓글은 FK on delete cascade로 함께 삭제, 첨부사진도 제거).
export async function DELETE(req: NextRequest) {
  try {
    const { postId, userId } = await req.json()
    if (!postId || !userId) return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 })
    const db = admin()
    const { data: p } = await db.from('posts').select('user_id, image_url').eq('id', postId).single()
    if (!p) return NextResponse.json({ ok: false, error: '글을 찾을 수 없어요' }, { status: 404 })
    if (!p.user_id || p.user_id !== userId) return NextResponse.json({ ok: false, error: '본인 글만 삭제할 수 있어요' }, { status: 403 })
    if (p.image_url) { try { await db.storage.from('post-images').remove([p.image_url]) } catch {} }
    const { error } = await db.from('posts').delete().eq('id', postId).eq('user_id', userId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
