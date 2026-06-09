import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // DB에서 현재 PIN 조회
    const { data: store, error: fetchErr } = await admin
      .from('stores')
      .select('pin_code')
      .eq('id', 'baegun')
      .single()

    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr

    const dbPin = store?.pin_code ?? '1234'

    // 현재 PIN 검증
    if (currentPin !== dbPin) {
      return NextResponse.json({ ok: false, error: '현재 PIN이 올바르지 않아요' }, { status: 400 })
    }

    // PIN 업데이트
    const { error: updateErr } = await admin
      .from('stores')
      .update({ pin_code: newPin })
      .eq('id', 'baegun')

    if (updateErr) throw updateErr

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
