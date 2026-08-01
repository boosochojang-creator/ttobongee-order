// 소셜 로그인 핸드오프용 서명 토큰 (서버 전용 · HMAC-SHA256). 외부 라이브러리 없이 컴팩트 JWT 유사.
// 용도: ① state(CSRF) ② session(콜백→클라 회원 핸드오프) ③ pending(신규 소셜신원, 연결/새로시작 선택 대기)
// 서버 세션 저장소 없이 서명+만료로 위·변조/재사용을 막는다(단기 만료).
import crypto from 'crypto'

const SECRET = process.env.AUTH_SESSION_SECRET || ''

function b64url(buf: Buffer) { return buf.toString('base64url') }

export function signToken(payload: Record<string, any>, ttlSec = 300): string {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }
  const p = b64url(Buffer.from(JSON.stringify(body)))
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(p).digest())
  return `${p}.${sig}`
}

export function verifyToken<T = any>(token: string | null | undefined): T | null {
  if (!token || !token.includes('.') || !SECRET) return null
  const [p, sig] = token.split('.')
  try {
    const expect = b64url(crypto.createHmac('sha256', SECRET).update(p).digest())
    const a = Buffer.from(sig), b = Buffer.from(expect)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const body = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'))
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null
    return body as T
  } catch { return null }
}
