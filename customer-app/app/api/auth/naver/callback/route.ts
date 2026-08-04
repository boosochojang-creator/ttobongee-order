import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '../../../../lib/supabaseAdmin'
import { signToken, verifyToken } from '../../../../lib/authToken'
import { oauthHash } from '../../../../lib/phoneCrypto'
import { sanitizeNickname } from '../../../../lib/nickname'

// 네이버 콜백 — 카카오 callback과 동일 골격.
//   ① 인가코드(+state) → 토큰 발급 ② /v1/nid/me 조회(response.id=식별자, nickname=닉네임) ③ 기존 users 매핑.
//   provider_uid(=oauthHash('naver', id)) 매핑이 있으면=재방문 로그인, 없으면=신규 소셜신원.
//   네이버 토큰요청은 콜백으로 되돌아온 state 원문을 그대로 전달해야 함.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const base = (() => { try { return new URL(process.env.NAVER_REDIRECT_URI!).origin } catch { return req.nextUrl.origin } })()
  const sp = req.nextUrl.searchParams
  const code = sp.get('code')
  const rawState = sp.get('state')
  const state = verifyToken<{ t: string; storeId: string; connect?: boolean }>(rawState)
  if (sp.get('error')) {
    return NextResponse.redirect(`${base}/store/baegun/auth/finish?err=denied&provider=naver`)
  }
  if (!code || !state || state.t !== 'state' || !rawState) {
    return NextResponse.redirect(`${base}/store/baegun/auth/finish?err=state&provider=naver`)
  }
  const storeId = state.storeId || 'baegun'
  const finish = (q: string) => NextResponse.redirect(`${base}/store/${storeId}/auth/finish?${q}&provider=naver`)

  try {
    // ① 토큰 발급 (네이버는 state를 함께 전달)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.NAVER_CLIENT_ID!,
      client_secret: process.env.NAVER_CLIENT_SECRET!,
      code,
      state: rawState,
    })
    const tok = await fetch('https://nid.naver.com/oauth2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }).then(r => r.json()).catch(() => null)
    if (!tok?.access_token) return finish('err=token')

    // ② 사용자 정보 조회 (response.id=식별자, nickname만 사용 — 이메일 등 미저장)
    const me = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    }).then(r => r.json()).catch(() => null)
    const naverId = me?.response?.id
    if (!naverId) return finish('err=profile')
    // 전화번호 패턴 마스킹 — 표시명에 전화번호가 있어도 우리 DB에 남지 않게. [개인정보 원칙]
    const nickname: string = sanitizeNickname(me?.response?.nickname || me?.response?.name || '')
    const uidHash = oauthHash('naver', naverId)

    // ③ 기존 users 매핑 조회 — 재방문이면 바로 로그인.
    const admin = adminClient()
    const { data: existing } = await admin.from('users')
      .select('id, withdrawn_at')
      .eq('store_id', storeId).eq('auth_provider', 'naver').eq('provider_uid', uidHash).maybeSingle()

    if (existing) {
      const patch: Record<string, any> = { last_visit: new Date().toISOString() }
      if ((existing as any).withdrawn_at) { patch.withdrawn_at = null; patch.phone = null; patch.phone_encrypted = null }
      await admin.from('users').update(patch).eq('id', existing.id)
      const session = signToken({ t: 'session', uid: existing.id }, 300)
      return finish(`token=${encodeURIComponent(session)}`)
    }

    // 신규 소셜신원 — 연결/새로시작 선택 후 확정(social-new·link는 provider 무관 공용). connect면 finish가 전화연결부터.
    const pending = signToken({ t: 'pending', provider: 'naver', uidHash, nickname }, 600)
    return finish(`pending=${encodeURIComponent(pending)}&nickname=${encodeURIComponent(nickname)}${state.connect ? '&connect=1' : ''}`)
  } catch {
    return finish('err=server')
  }
}
