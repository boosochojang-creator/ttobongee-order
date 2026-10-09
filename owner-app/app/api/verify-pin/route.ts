import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { STORE_ID } from '../../lib/store'
import { setOwnerCookie } from '../../lib/ownerAuth.server'
import { checkOperatorPin } from '../../lib/operatorPin.server'

// E그룹: 점주 입장 PIN 검증을 서버로 이전 — bcrypt.compare. (기존: 클라이언트가 평문 pin_code를 받아 비교 → 보안 취약)
// pin_code_hash 우선, 아직 백필 안 된 경우 평문 pin_code 폴백 + 자가치유(해시 생성해 저장).
// 성공이면 점주 출입증 쿠키(12시간)도 심는다 — 모든 점주 서버 기능이 이 쿠키를 확인(middleware.ts)
function passed(ok: boolean, operator = false) {
  const res = NextResponse.json({ ok, operator })
  if (ok) setOwnerCookie(res, STORE_ID, operator)
  return res
}

export async function POST(req: NextRequest) {
  try {
    const { pin, operator } = await req.json()
    // 어울장 운영자 입장 — 매장 PIN과 관계없이 운영자 비밀번호(숫자 6~8자리)로 점주 화면에 들어감(2026-10-09 사장님 요청)
    if (operator) {
      if (!/^\d{6,8}$/.test(pin || '')) return NextResponse.json({ ok: false, error: '운영자 비밀번호는 숫자 6~8자리예요' }, { status: 400 })
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'x'
      const r = await checkOperatorPin(pin, ip)
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status })
      return passed(true, true)
    }
    if (!/^\d{4}$/.test(pin || '')) {
      return NextResponse.json({ ok: false, error: 'PIN 형식 오류' }, { status: 400 })
    }
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    // select('*') — pin_code_hash 컬럼이 아직 없어도(022 미실행) 에러 안 나게(마이그레이션 내성)
    const { data: store } = await admin.from('stores').select('*').eq('id', STORE_ID).single()

    // 1) 해시가 있으면 bcrypt 비교
    if (store?.pin_code_hash) {
      const ok = await bcrypt.compare(pin, store.pin_code_hash)
      return passed(ok)
    }

    // 2) 폴백: 아직 해시 없음(백필 전) → 평문 비교, 맞으면 해시 생성해 저장(자가치유)
    const dbPin = store?.pin_code ?? '1234'
    if (pin === dbPin) {
      try { await admin.from('stores').update({ pin_code_hash: await bcrypt.hash(pin, 10) }).eq('id', STORE_ID) } catch {}
      return passed(true)
    }
    return NextResponse.json({ ok: false })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
