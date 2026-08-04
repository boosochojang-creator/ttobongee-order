import { NextRequest, NextResponse } from 'next/server'
import { signToken } from '../../../../lib/authToken'

// 카카오 인가 코드 요청 — 카카오 인증 화면으로 302 리다이렉트.
// state는 서명 토큰(CSRF 방지 + storeId 전달). scope는 최소(닉네임만).
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get('storeId') || 'baegun'
  const key = process.env.KAKAO_REST_API_KEY
  const redirect = process.env.KAKAO_REDIRECT_URI
  if (!key || !redirect) {
    // origin은 -H 0.0.0.0 바인딩 시 0.0.0.0으로 잡히므로, 가능하면 redirect_uri 호스트 기준.
    const base = (() => { try { return new URL(redirect!).origin } catch { return req.nextUrl.origin } })()
    return NextResponse.redirect(`${base}/store/${storeId}/auth/finish?err=config`)
  }
  const connect = req.nextUrl.searchParams.get('mode') === 'connect' // 기존 전화회원의 계정연결 진입
  const state = signToken({ t: 'state', storeId, connect, n: Math.random().toString(36).slice(2) }, 600)
  const url = new URL('https://kauth.kakao.com/oauth/authorize')
  url.searchParams.set('client_id', key)
  url.searchParams.set('redirect_uri', redirect)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'profile_nickname') // 이메일·전화 미수집
  url.searchParams.set('state', state)
  return NextResponse.redirect(url.toString())
}
