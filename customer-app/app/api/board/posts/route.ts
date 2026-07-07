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
    if (!['music', 'arcade', 'board'].includes(source || '')) {
      return NextResponse.json({ ok: false, error: 'source 필요' }, { status: 400 })
    }
    const db = admin()
    const { data: posts } = await db.from('posts')
      .select('id, author_name, is_anonymous, is_secret, content, image_url, created_at')
      .eq('store_id', 'baegun').eq('source', source)
      .order('created_at', { ascending: false }).limit(100)

    const ids = (posts || []).map(p => p.id)
    const counts: Record<string, number> = {}
    if (ids.length) {
      const { data: cs } = await db.from('comments').select('post_id').in('post_id', ids)
      for (const c of cs || []) counts[c.post_id] = (counts[c.post_id] || 0) + 1
    }
    // 비밀글은 목록에서 내용/사진 가림 (열람은 5-2-e에서 점주/작성자 비번). 공개글은 그대로.
    const list = (posts || []).map(p => ({
      id: p.id, author_name: p.author_name, created_at: p.created_at,
      is_secret: p.is_secret, comment_count: counts[p.id] || 0,
      content: p.is_secret ? null : p.content,
      has_image: !!p.image_url,
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
    let imageKey: string | null = null
    if (isSecret) {
      const pw = String(b.secret_pw || '')
      if (pw.length < 2) return NextResponse.json({ ok: false, error: '비밀번호를 입력해주세요 (2자 이상)' }, { status: 400 })
      secretHash = hashSecret(pw)
      // 사진 첨부 (비밀글만): 클라이언트가 압축한 data URL → post-images 비공개 버킷
      if (typeof b.image === 'string' && b.image.startsWith('data:image/')) {
        const m = b.image.match(/^data:(image\/[\w+.-]+);base64,(.+)$/)
        if (m) {
          const ext = (m[1].split('/')[1] || 'jpg').replace('jpeg', 'jpg')
          const bytes = Buffer.from(m[2], 'base64')
          const key = `post-${randomUUID()}.${ext}`
          const { error: upErr } = await db.storage.from('post-images').upload(key, bytes, { contentType: m[1], upsert: false })
          if (!upErr) imageKey = key
        }
      }
    }

    const { data, error } = await db.from('posts').insert({
      store_id: 'baegun', source, user_id: b.userId || null,
      author_name: authorName, is_anonymous: anonymous, content,
      is_secret: isSecret, secret_pw_hash: secretHash, image_url: imageKey,
    }).select('id').single()
    if (error) throw error
    return NextResponse.json({ ok: true, id: data.id })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
