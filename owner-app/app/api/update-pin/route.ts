import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { STORE_ID } from '../../lib/store'

export async function POST(req: NextRequest) {
  try {
    const { currentPin, newPin } = await req.json()

    if (!currentPin || !newPin || !/^\d{4}$/.test(newPin)) {
      return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 현재 PIN 검증 — 해시 우선(bcrypt.compare), 없으면 평문 폴백
    const { data: store, error: fetchErr } = await admin
      .from('stores')
      .select('*')
      .eq('id', STORE_ID)
      .single()
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr

    const currentOk = store?.pin_code_hash
      ? await bcrypt.compare(currentPin, store.pin_code_hash)
      : currentPin === (store?.pin_code ?? '1234')
    if (!currentOk) {
      return NextResponse.json({ ok: false, error: '현재 PIN이 올바르지 않아요' }, { status: 400 })
    }

    // 새 PIN 저장 — bcrypt 해시 + 평문(전환 중 dual-write). pin_code_hash 컬럼이 있을 때만 해시도 기록(022 내성).
    const patch: Record<string, any> = { pin_code: newPin }
    if (store && 'pin_code_hash' in store) patch.pin_code_hash = await bcrypt.hash(newPin, 10)
    const { error: updateErr } = await admin.from('stores').update(patch).eq('id', STORE_ID)

    if (updateErr) throw updateErr

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
