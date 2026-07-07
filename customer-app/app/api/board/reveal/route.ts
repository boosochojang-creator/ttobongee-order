import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySecret } from '../../../../lib/secretPw'

// Phase 5-2-e-1: 비밀글 재조회 — 작성자가 비밀번호 입력하면 내용+사진(서명URL) 반환.
// (점주 열람은 오너앱 통합조회 5-2-e-2에서 비번 없이 서비스롤로 처리)
export async function POST(req: NextRequest) {
  try {
    const { postId, password } = await req.json()
    if (!postId) return NextResponse.json({ ok: false, error: 'postId 필요' }, { status: 400 })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: p } = await admin.from('posts')
      .select('is_secret, secret_pw_hash, content, image_url').eq('id', postId).single()
    if (!p) return NextResponse.json({ ok: false, error: '글을 찾을 수 없어요' }, { status: 404 })
    if (!p.is_secret) return NextResponse.json({ ok: true, content: p.content, imageUrl: null })

    if (!verifySecret(String(password || ''), p.secret_pw_hash)) {
      return NextResponse.json({ ok: false, error: '비밀번호가 맞지 않아요' }, { status: 403 })
    }
    let imageUrl: string | null = null
    if (p.image_url) {
      const { data: signed } = await admin.storage.from('post-images').createSignedUrl(p.image_url, 300)
      imageUrl = signed?.signedUrl || null
    }
    return NextResponse.json({ ok: true, content: p.content, imageUrl })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
