// E2: 전화번호 암호화 — 서버 전용(절대 client 컴포넌트에서 import 금지. 키가 노출됨).
// 조회용 해시(HMAC-SHA256, 단방향)와 저장용 암호화(AES-256-GCM, 복호화 가능) 이중 구조.
// 키는 Vercel 환경변수로만 관리: PHONE_HASH_SECRET, PHONE_ENC_KEY (각 32바이트 hex).
import crypto from 'crypto'

const HASH_SECRET = process.env.PHONE_HASH_SECRET || ''
const ENC_KEY_HEX = process.env.PHONE_ENC_KEY || ''

export function phoneDigits(phone: string | null | undefined): string {
  return (phone || '').replace(/\D/g, '')
}

// 조회용: 같은 번호 → 항상 같은 해시(=eq 비교 가능), 원본 복원 불가.
export function phoneHash(phone: string | null | undefined): string {
  return crypto.createHmac('sha256', HASH_SECRET).update(phoneDigits(phone)).digest('hex')
}

// 저장용: iv(12) + authTag(16) + ciphertext 를 base64로. 복호화 가능.
export function phoneEncrypt(phone: string | null | undefined): string | null {
  const d = phoneDigits(phone)
  if (!d) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENC_KEY_HEX, 'hex'), iv)
  const ct = Buffer.concat([cipher.update(d, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64')
}

export function phoneDecrypt(enc: string | null | undefined): string | null {
  if (!enc) return null
  try {
    const buf = Buffer.from(enc, 'base64')
    const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENC_KEY_HEX, 'hex'), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  } catch { return null }
}

// 표시용 마스킹(복호화한 번호를 화면에 부분만 노출할 때). 예: 010****1726
export function maskPhone(digits: string | null | undefined): string {
  const d = phoneDigits(digits)
  if (d.length < 8) return d || '-'
  return d.slice(0, 3) + '****' + d.slice(-4)
}
