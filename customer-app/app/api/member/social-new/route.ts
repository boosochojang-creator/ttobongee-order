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

    // 이미 이 provider_uid로 가입 이력이 있으면(탈퇴 포함) 새 계정/쿠폰 만들지 않고 그 회원 재사용.
    // (콜백이 정상이면 여기 도달 전에 걸리지만, 어뷰징/엣지 방어로 한 번 더.)
    const { data: dupe } = await admin.from('users')
      .select('id, grade, visit_count, nickname, member_status, withdrawn_at')
      .eq('store_id', sid).eq('auth_provider', v.provider).eq('provider_uid', v.uidHash).maybeSingle()

    let user = dupe as any
    let created = false
    if (user) {
      // 탈퇴 상태면 재활성화(재가입) — 신규쿠폰은 발급하지 않음(이력 있음). 탈퇴흔적 phone 잔재도 정리.
      if ((user as any).withdrawn_at) await admin.from('users').update({ withdrawn_at: null, phone: null, phone_encrypted: null, last_visit: new Date().toISOString() }).eq('id', user.id)
    } else {
      const { data: nu, error } = await admin.from('users').insert({
        store_id: sid, auth_provider: v.provider, provider_uid: v.uidHash,
        nickname: sanitizeNickname(v.nickname) || null, device_id: deviceId || null, // 전화 패턴 마스킹
        // phone 없음(null) — 소셜 전용 회원
      }).select('id, grade, visit_count, nickname, member_status').single()
      if (error || !nu) throw error || new Error('회원 생성 실패')
      user = nu; created = true
    }

    // [쿠폰 무한발급 방지] '완전히 처음 보는 신원'일 때만 signup 쿠폰.
    //   - 같은 provider_uid 이력: 위 dupe로 이미 created=false → 발급 안 함.
    //   - 같은 device_id로 과거 signup 받은 이력: 아래에서 차단(다른 카카오로 기기 어뷰징 방지).
    if (created) {
      let allowSignup = true
      if (deviceId) {
        const { data: sameDev } = await admin.from('users').select('id').eq('store_id', sid).eq('device_id', deviceId).neq('id', user.id)
        const priorIds = (sameDev || []).map((x: any) => x.id)
        if (priorIds.length) {
          const { data: had } = await admin.from('coupons').select('id').eq('type', 'signup').in('user_id', priorIds).limit(1)
          if (had && had.length) allowSignup = false
        }
      }
      if (allowSignup) await issueSignupCoupon(admin, user.id)
    }

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
