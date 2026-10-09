// [플랫폼] 점주·운영자 서버 인증 — PIN 확인에 성공하면 서명된 쿠키(httpOnly)를 심고, 민감한 API는 이 쿠키가 있어야 동작.
//  · 점주: verify-pin 성공 → eoul_owner(매장 id, 12시간)
//  · 어울장 운영자(/admin): 플랫폼 행(stores.id='platform') PIN 확인 → eoul_admin(12시간)
//  서명 키는 서버 전용 서비스 키에서 파생(브라우저로 나가지 않음).
import crypto from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'

const TTL_SEC = 12 * 3600
export const OWNER_COOKIE = 'eoul_owner'
export const ADMIN_COOKIE = 'eoul_admin'

const key = () => crypto.createHash('sha256').update('eoul-owner-auth:' + (process.env.SUPABASE_SERVICE_ROLE_KEY || '')).digest()
const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')

function sign(payload: object) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TTL_SEC }))
  return `${body}.${b64(crypto.createHmac('sha256', key()).update(body).digest())}`
}
function read(token?: string | null): any | null {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  const want = b64(crypto.createHmac('sha256', key()).update(body).digest())
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString())
    return p.exp > Date.now() / 1000 ? p : null
  } catch { return null }
}

function setCookie(res: NextResponse, name: string, payload: object) {
  res.cookies.set(name, sign(payload), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: TTL_SEC })
}
export const setOwnerCookie = (res: NextResponse, storeId: string, operator = false) => setCookie(res, OWNER_COOKIE, operator ? { sid: storeId, op: true } : { sid: storeId })
export const setAdminCookie = (res: NextResponse) => setCookie(res, ADMIN_COOKIE, { admin: true })

// 이 요청이 그 매장 점주인가
export const isOwner = (req: NextRequest, storeId: string) => read(req.cookies.get(OWNER_COOKIE)?.value)?.sid === storeId
// 어울장 운영자인가
export const isAdmin = (req: NextRequest) => read(req.cookies.get(ADMIN_COOKIE)?.value)?.admin === true
