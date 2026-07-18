import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { STORE_ID } from '../../../lib/store'

// Phase 5-1-a: 라이더 등록 (서비스롤). access_token 자동생성 → /rider?token=... 접속용.
export async function POST(req: NextRequest) {
  try {
    const { name, phone } = await req.json()
    if (!name || !name.trim()) return NextResponse.json({ ok: false, error: '이름을 입력해주세요' }, { status: 400 })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data, error } = await admin.from('riders').insert({
      store_id: STORE_ID, name: name.trim(),
      phone: (phone || '').replace(/\D/g, '') || null,
      access_token: randomUUID(), is_active: true,
    }).select('id, name, phone, access_token, is_active').single()
    if (error) throw error
    return NextResponse.json({ ok: true, rider: data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
