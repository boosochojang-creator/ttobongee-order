// Phase 5-2-e: 비밀글 비밀번호 해시 (외부 의존성 없이 node:crypto scrypt). "scrypt:salt:hash"
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

export function hashSecret(pw: string): string {
  const salt = randomBytes(16).toString('hex')
  const h = scryptSync(pw, salt, 32).toString('hex')
  return `scrypt:${salt}:${h}`
}

export function verifySecret(pw: string, stored: string | null | undefined): boolean {
  try {
    if (!stored) return false
    const [alg, salt, h] = stored.split(':')
    if (alg !== 'scrypt' || !salt || !h) return false
    const cand = scryptSync(pw, salt, 32)
    const stored32 = Buffer.from(h, 'hex')
    return stored32.length === cand.length && timingSafeEqual(stored32, cand)
  } catch {
    return false
  }
}
