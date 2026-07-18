import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { STORE_ID } from '../../lib/store'

// E그룹: 점주 입장 PIN 검증을 서버로 이전 — bcrypt.compare. (기존: 클라이언트가 평문 pin_code를 받아 비교 → 보안 취약)
// pin_code_hash 우선, 아직 백필 안 된 경우 평문 pin_code 폴백 + 자가치유(해시 생성해 저장).
export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json()
    if (!/^\d{4}$/.test(pin || '')) {
      return NextResponse.json({ ok: false, error: 'PIN 형식 오류' }, { status: 400 })
    }
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    // select('*') — pin_code_hash 컬럼이 아직 없어도(022 미실행) 에러 안 나게(마이그레이션 내성)
    const { data: store } = await admin.from('stores').select('*').eq('id', STORE_ID).single()

    // 1) 해시가 있으면 bcrypt 비교
    if (store?.pin_code_hash) {
      const ok = await bcrypt.compare(pin, store.pin_code_hash)
      return NextResponse.json({ ok })
    }

    // 2) 폴백: 아직 해시 없음(백필 전) → 평문 비교, 맞으면 해시 생성해 저장(자가치유)
    const dbPin = store?.pin_code ?? '1234'
    if (pin === dbPin) {
      try { await admin.from('stores').update({ pin_code_hash: await bcrypt.hash(pin, 10) }).eq('id', STORE_ID) } catch {}
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ ok: false })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
