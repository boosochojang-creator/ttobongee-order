import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyToken } from '../../../lib/authToken'
import { issueSignupCoupon } from '../../../lib/signupCoupon'
import { sanitizeNickname } from '../../../lib/nickname'

// [그룹2 새로시작] 신규 소셜신원 → 새 회원 생성(phone=null) + signup 쿠폰 즉시발급.
//   전화 연결을 안 한 진짜 신규만 이 경로. (전화 미수집)
export async function POST(req: NextRequest) {
  try {
    const { pending, storeId, deviceId } = await req.json()
    const v = verifyToken<{ t: string; provider: string; uidHash: string; nickname: string }>(pending)
    if (!v || v.t !== 'pending') {
      return NextResponse.json({ ok: false, error: '인증이 만료됐어요. 다시 로그인해주세요' }, { status: 401 })
    }
    const sid = storeId || 'baegun'
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // 이미 연결된 소셜이면(중복 콜백/뒤로가기) 그 회원 반환 — 중복 생성 방지
    const { data: dupe } = await admin.from('users')
      .select('id, grade, visit_count, nickname, member_status')
      .eq('store_id', sid).eq('auth_provider', v.provider).eq('provider_uid', v.uidHash).maybeSingle()

    let user = dupe as any
    let created = false
    if (!user) {
      const { data: nu, error } = await admin.from('users').insert({
        store_id: sid, auth_provider: v.provider, provider_uid: v.uidHash,
        nickname: sanitizeNickname(v.nickname) || null, device_id: deviceId || null, // 전화 패턴 마스킹
        // phone 없음(null) — 소셜 전용 회원
      }).select('id, grade, visit_count, nickname, member_status').single()
      if (error || !nu) throw error || new Error('회원 생성 실패')
      user = nu; created = true
    }

    if (created) await issueSignupCoupon(admin, user.id) // 신규만 signup 쿠폰(연결 회원은 재발급 안 함)

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id, grade: user.grade ?? 'bronze', visit_count: user.visit_count ?? 0,
        nickname: user.nickname ?? '', member_status: user.member_status ?? null,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
