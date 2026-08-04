import { NextRequest, NextResponse } from 'next/server'
import { signToken } from '../../../../lib/authToken'

// 네이버 인가 코드 요청 — 네이버 인증 화면으로 302 리다이렉트. (카카오 start와 동일 골격)
// 수집 항목은 네이버 앱 설정을 따름(닉네임만 사용). state는 서명 토큰(CSRF+storeId), 콜백/토큰요청에 그대로 사용.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get('storeId') || 'baegun'
  const clientId = process.env.NAVER_CLIENT_ID
  const redirect = process.env.NAVER_REDIRECT_URI
  if (!clientId || !redirect) {
    const base = (() => { try { return new URL(redirect!).origin } catch { return req.nextUrl.origin } })()
    return NextResponse.redirect(`${base}/store/${storeId}/auth/finish?err=config&provider=naver`)
  }
  const connect = req.nextUrl.searchParams.get('mode') === 'connect' // 기존 전화회원의 계정연결 진입
  const state = signToken({ t: 'state', storeId, connect, n: Math.random().toString(36).slice(2) }, 600)
  const url = new URL('https://nid.naver.com/oauth2.0/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirect)
  url.searchParams.set('state', state)
  return NextResponse.redirect(url.toString())
}
