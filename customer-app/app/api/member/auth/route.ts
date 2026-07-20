import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { phoneHash, phoneEncrypt, phoneDigits } from '../../../lib/phoneCrypto'

// E2: 회원 로그인/가입 — 전화번호 해시 조회 + dual-write. 서버 전용(HMAC/AES 키가 서버 비밀).
// 기존 클라이언트(anon) 직접 조회/insert를 대체. 조회는 phone_hash로, 저장은 phone+phone_hash+phone_encrypted 동시(전환 중 안전장치).
export async function POST(req: NextRequest) {
  try {
    const { phone, storeId } = await req.json()
    const digits = phoneDigits(phone)
    if (digits.length < 10) {
      return NextResponse.json({ ok: false, error: '전화번호를 정확히 입력해주세요' }, { status: 400 })
    }
    const sid = storeId || 'baegun'
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const hash = phoneHash(digits)

    // 1) 해시로 조회 (탈퇴한 회원도 phone_hash는 보존돼 있어 여기서 잡힘 → 재활성화 대상)
    let { data: existing } = await admin.from('users')
      .select('id, grade, visit_count, nickname, member_status, withdrawn_at')
      .eq('store_id', sid).eq('phone_hash', hash).maybeSingle()

    // 2) 폴백: 아직 백필 안 된 레거시(평문 phone만) — 있으면 hash/enc 채워주고 사용(자가치유)
    //    (탈퇴 행은 평문 phone이 'withdrawn:'로 치환돼 있어 이 폴백엔 안 걸림)
    if (!existing) {
      const { data: legacy } = await admin.from('users')
        .select('id, grade, visit_count, nickname, member_status, withdrawn_at')
        .eq('store_id', sid).eq('phone', digits).maybeSingle()
      if (legacy) {
        await admin.from('users').update({ phone_hash: hash, phone_encrypted: phoneEncrypt(digits) }).eq('id', legacy.id)
        existing = legacy
      }
    }

    let user = existing
    let rejoined = false
    if (user) {
      // [항목1] 탈퇴 이력이 있으면 재활성화(같은 user_id 복원) → 쿠폰 중복방지가 기존 로직으로 자동 처리(신규가입 쿠폰 미발급).
      const patch: Record<string, any> = { last_visit: new Date().toISOString() }
      if ((user as any).withdrawn_at) { patch.withdrawn_at = null; rejoined = true }
      await admin.from('users').update(patch).eq('id', user.id)
    } else {
      // 3) 신규 가입 — dual-write (phone 평문은 전환 중 유지, 나중에 별도 지시로 제거)
      const { data: created, error } = await admin.from('users').insert({
        store_id: sid, phone: digits, phone_hash: hash, phone_encrypted: phoneEncrypt(digits),
      }).select('id, grade, visit_count, nickname, member_status, withdrawn_at').single()
      if (error || !created) throw error || new Error('회원 생성 실패')
      user = created
    }

    return NextResponse.json({
      ok: true,
      rejoined, // [항목1] 재가입(재활성화) 여부 — 클라이언트가 '가입 이력 안내' 표시에 사용
      user: {
        id: user.id,
        grade: user.grade ?? 'bronze',
        visit_count: user.visit_count ?? 0,
        nickname: user.nickname ?? '',
        member_status: user.member_status ?? null,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
