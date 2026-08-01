import { NextRequest, NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { adminClient } from '../../../lib/supabaseAdmin'

// [고객상태 통합] 모든 진입/안내 화면이 참조하는 단일 상태 소스.
//   2축으로 정규화: 신원(guest|known) × 프로필(incomplete|complete).
//   요구 A/B/C/D = A:guest / B:known+incomplete / C:known+complete / D:known(재방문, 프로필 별개).
//   완성(C) 정의(확정): 닉네임 + 생일 + 수신동의(이메일·주소 제외 — 이메일 미수집·배달 비활성과 정합).
//   '중복 안내 금지'는 서버 플래그(profile_prompt_dismiss_count 등)로 판정 → 기기 바뀌어도 다시 안 뜸.
export const dynamic = 'force-dynamic'

const MAX_HINT_DISMISS = 3 // 3회 닫으면 프로필 안내 영구 중단(기존 정책 계승, 서버 권위화)

// 표시명 — 닉네임 우선(전화 미수집이라 폴백 없음). 없으면 null(호출부에서 기본 처리).
function displayName(nickname: string | null | undefined): string | null {
  const nk = (nickname || '').trim()
  return nk || null
}

export async function GET(req: NextRequest) {
  noStore()
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    // userId 없음 = 로그인 전 = 완전 신규(A)
    if (!userId) {
      return NextResponse.json({ ok: true, identity: 'guest', profile: 'incomplete', greeting: null, banners: { profileHint: false } })
    }
    const admin = adminClient()
    const { data: u } = await admin.from('users')
      .select('id, nickname, birthday, marketing_opt_in, withdrawn_at, profile_prompt_dismiss_count, visit_count, grade')
      .eq('id', userId).maybeSingle()

    // 계정 없음/탈퇴 = 사실상 guest 취급(클라가 재로그인 유도)
    if (!u || (u as any).withdrawn_at) {
      return NextResponse.json({ ok: true, identity: 'guest', profile: 'incomplete', greeting: null, banners: { profileHint: false } })
    }

    // 완성(C) 판정: 닉네임 + 생일 + 수신동의
    const hasNickname = !!displayName((u as any).nickname)
    const hasBirthday = !!((u as any).birthday)
    const optedIn = (u as any).marketing_opt_in === true
    const profile: 'complete' | 'incomplete' = (hasNickname && hasBirthday && optedIn) ? 'complete' : 'incomplete'

    // 프로필 안내 배너: 미완성 + 아직 3회 미만 닫음일 때만 (중복 안내 금지 — 서버 권위)
    const dismissCount = Number((u as any).profile_prompt_dismiss_count) || 0
    const profileHint = profile === 'incomplete' && dismissCount < MAX_HINT_DISMISS

    const name = displayName((u as any).nickname)
    return NextResponse.json({
      ok: true,
      identity: 'known',
      profile,
      greeting: name ? `${name}님, 또 오셨군요` : '또 오셨군요',
      banners: { profileHint },
      // 참고 정보(화면 표시용)
      member: { grade: (u as any).grade ?? 'bronze', visit_count: (u as any).visit_count ?? 0, nickname: name },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
