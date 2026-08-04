import { NextRequest, NextResponse } from 'next/server'
import { signToken } from '../../../../lib/authToken'

// 구글 인가 코드 요청 — 구글 인증 화면으로 302 리다이렉트. (카카오 start와 동일 골격)
// scope는 최소(openid=식별자 sub, profile=닉네임). 이메일·전화 미수집. state는 서명 토큰(CSRF+storeId).
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get('storeId') || 'baegun'
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirect = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !redirect) {
    const base = (() => { try { return new URL(redirect!).origin } catch { return req.nextUrl.origin } })()
    return NextResponse.redirect(`${base}/store/${storeId}/auth/finish?err=config&provider=google`)
  }
  const connect = req.nextUrl.searchParams.get('mode') === 'connect' // 기존 전화회원의 계정연결 진입
  const state = signToken({ t: 'state', storeId, connect, n: Math.random().toString(36).slice(2) }, 600)
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirect)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid profile') // 이메일 미수집(sub=식별자, name=닉네임)
  url.searchParams.set('state', state)
  return NextResponse.redirect(url.toString())
}
