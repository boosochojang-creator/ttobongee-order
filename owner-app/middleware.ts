// [또봉이] 점주앱 서버 기능(API) 관문 — PIN 입장 때 받은 서명 출입증(eoul_owner 쿠키)이 없으면 거절(401).
//  2026-10-09 사장님 승인: 화면 잠금만 있고 API는 주소만 알면 열리던 문제를 한곳에서 막는다(어울장 점주앱과 같은 방식).
//  예외(출입증 없이 통과):
//   · /api/verify-pin  — 출입증을 받는 입구(점주 PIN 또는 어울장 운영자 비밀번호)
//   · /api/version     — 배포 버전 확인(공개 정보)
//   · GET /api/close-business — 매일 03:00 자동 마감 예약 작업. 라우트가 새벽 시간대에만 동작하게 막음
//  서명 확인은 lib/ownerAuth.server.ts(서버)와 같은 키·형식(HMAC-SHA256)을 Web Crypto로 계산.
import { NextResponse, type NextRequest } from 'next/server'

const OPEN = new Set(['/api/verify-pin', '/api/version'])
const enc = new TextEncoder()

function b64url(buf: ArrayBuffer) {
  const u = new Uint8Array(buf); let s = ''
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function validOwner(token: string | undefined, storeId: string) {
  if (!token || !token.includes('.')) return false
  const [body, sig] = token.split('.')
  const raw = await crypto.subtle.digest('SHA-256', enc.encode('eoul-owner-auth:' + (process.env.SUPABASE_SERVICE_ROLE_KEY || '')))
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const want = b64url(await crypto.subtle.sign('HMAC', key, enc.encode(body)))
  if (want.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i)
  if (diff) return false
  try {
    const p = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')))
    return p.sid === storeId && p.exp > Date.now() / 1000
  } catch { return false }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (OPEN.has(pathname)) return NextResponse.next()
  if (pathname === '/api/close-business' && req.method === 'GET') return NextResponse.next()
  const storeId = (process.env.NEXT_PUBLIC_STORE_ID || 'baegun').trim() // lib/store.ts와 같은 기본값
  if (await validOwner(req.cookies.get('eoul_owner')?.value, storeId)) return NextResponse.next()
  return NextResponse.json({ ok: false, error: '다시 로그인해 주세요', code: 'auth' }, { status: 401 })
}

export const config = { matcher: ['/api/:path*'] }
