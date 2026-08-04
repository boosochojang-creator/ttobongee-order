import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '../../../lib/supabaseAdmin'
import { verifyToken } from '../../../lib/authToken'
import { phoneHash, phoneDigits } from '../../../lib/phoneCrypto'
import { sanitizeNickname } from '../../../lib/nickname'
import { issueConnectCoupon } from '../../../lib/connectCoupon'

// [그룹2 연결] 신규 소셜신원 + 전화 1회 입력 → 기존 전화 단골과 매칭.
//   매칭되면 기존 user_id에 provider 부착 + 전화(phone/phone_encrypted) 자동 파기(2c).
//   ★쿠폰은 user_id 그대로 재사용이라 usable/upcoming 자동 보존 — 신규 user 생성/재발급 없음.
export async function POST(req: NextRequest) {
  try {
    const { pending, phone, storeId, deviceId } = await req.json()
    const v = verifyToken<{ t: string; provider: string; uidHash: string; nickname: string }>(pending)
    if (!v || v.t !== 'pending') {
      return NextResponse.json({ ok: false, error: '인증이 만료됐어요. 다시 로그인해주세요' }, { status: 401 })
    }
    const digits = phoneDigits(phone)
    if (digits.length < 10) {
      return NextResponse.json({ ok: false, error: '전화번호를 정확히 입력해주세요' }, { status: 400 })
    }
    const sid = storeId || 'baegun'
    const admin = adminClient()

    // 기존 전화회원 조회(탈퇴 포함 — 재활성화 대상)
    const hash = phoneHash(digits)
    const { data: existing } = await admin.from('users')
      .select('id, withdrawn_at, nickname')
      .eq('store_id', sid).eq('phone_hash', hash).maybeSingle()
    if (!existing) {
      return NextResponse.json({ ok: false, code: 'no_match', error: '그 번호로 가입된 단골 정보가 없어요. ‘새로 시작’으로 진행해주세요' }, { status: 404 })
    }

    // 이 소셜계정이 이미 다른 회원에 연결돼 있으면 차단
    const { data: dupe } = await admin.from('users')
      .select('id').eq('store_id', sid).eq('auth_provider', v.provider).eq('provider_uid', v.uidHash).maybeSingle()
    if (dupe && dupe.id !== existing.id) {
      const plabel = ({ kakao: '카카오', google: '구글', naver: '네이버' } as Record<string, string>)[v.provider] || '소셜 계정'
      return NextResponse.json({ ok: false, error: `이미 다른 계정에 연결된 ${plabel}예요` }, { status: 409 })
    }

    // 기존 user_id에 provider 부착 + 전화 파기(2c). 탈퇴였으면 재활성화. 표시명 없으면 카카오 닉네임으로.
    const patch: Record<string, any> = {
      auth_provider: v.provider, provider_uid: v.uidHash,
      phone: null, phone_encrypted: null,
      last_visit: new Date().toISOString(),
    }
    if (!(existing as any).nickname) { const nn = sanitizeNickname(v.nickname); if (nn) patch.nickname = nn } // 전화 패턴 마스킹
    if ((existing as any).withdrawn_at) patch.withdrawn_at = null
    if (deviceId) patch.device_id = deviceId
    const { error: uErr } = await admin.from('users').update(patch).eq('id', existing.id)
    if (uErr) throw uErr

    // [계정연결 보상] 전화회원이 소셜 연결을 완료한 순간 = 연결 보상 쿠폰 1회 지급(콜라/사이다 택1).
    await issueConnectCoupon(admin, existing.id)

    const { data: user } = await admin.from('users')
      .select('id, grade, visit_count, nickname, member_status').eq('id', existing.id).single()
    return NextResponse.json({
      ok: true,
      connected: true, // 연결 완료 신호(클라 안내용)
      rejoined: !!(existing as any).withdrawn_at,
      user: {
        id: user!.id, grade: user!.grade ?? 'bronze', visit_count: user!.visit_count ?? 0,
        nickname: user!.nickname ?? '', member_status: user!.member_status ?? null,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
