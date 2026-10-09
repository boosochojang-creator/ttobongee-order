// [플랫폼] 어울장 운영자 출입 — 매장 PIN 화면에서 운영자 비밀번호(플랫폼 행 stores.id='platform'의 해시)로도 입장.
//  매장 점주 PIN과 상관없이 운영자가 모든 입점 매장 점주 화면을 확인·수정할 수 있게 한다(사장님 요청 2026-10-09).
//  5번 틀리면 5분 잠금(서버 인스턴스 기준).
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

const fails = new Map<string, { n: number; until: number }>()

export type OperatorCheck = { ok: boolean; error?: string; status?: number }

export async function checkOperatorPin(pin: string, ip: string): Promise<OperatorCheck> {
  const f = fails.get(ip)
  if (f && f.until > Date.now()) return { ok: false, error: '여러 번 틀려서 5분 동안 잠겼어요', status: 429 }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await admin.from('stores').select('pin_code_hash').eq('id', 'platform').maybeSingle()
  const hash = (data as any)?.pin_code_hash
  if (hash && (await bcrypt.compare(pin, hash))) { fails.delete(ip); return { ok: true } }
  const n = (f?.n || 0) + 1
  fails.set(ip, { n: n >= 5 ? 0 : n, until: n >= 5 ? Date.now() + 5 * 60 * 1000 : 0 })
  return { ok: false, error: '운영자 비밀번호가 맞지 않아요', status: 401 }
}
