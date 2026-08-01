import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '../../../../lib/supabaseAdmin'
import { signToken, verifyToken } from '../../../../lib/authToken'
import { oauthHash } from '../../../../lib/phoneCrypto'
import { sanitizeNickname } from '../../../../lib/nickname'

// 카카오 콜백 — ① 인가코드 → 토큰 발급 ② 사용자 정보 조회 ③ 기존 users 매핑.
//   provider_uid 매핑이 있으면=재방문 로그인, 없으면=신규 소셜신원(연결/새로시작 선택으로).
//   결과는 서명 단기토큰으로 finish 페이지에 전달(서버→클라 localStorage 핸드오프).
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // dev를 -H 0.0.0.0으로 띄우면 req.nextUrl.origin이 '0.0.0.0:3000'으로 잡혀 리다이렉트가 깨진다.
  // OAuth 콜백은 redirect_uri와 동일 호스트에서만 도착하므로, KAKAO_REDIRECT_URI의 origin을 기준으로 삼는다
  // (프로덕션에선 프로덕션 도메인이 자동 반영됨). env 없을 때만 요청 origin으로 폴백.
  const base = (() => { try { return new URL(process.env.KAKAO_REDIRECT_URI!).origin } catch { return req.nextUrl.origin } })()
  const sp = req.nextUrl.searchParams
  const code = sp.get('code')
  const state = verifyToken<{ t: string; storeId: string }>(sp.get('state'))
  if (sp.get('error')) {
    // 사용자가 동의 취소 등
    return NextResponse.redirect(`${base}/store/baegun/auth/finish?err=denied`)
  }
  if (!code || !state || state.t !== 'state') {
    return NextResponse.redirect(`${base}/store/baegun/auth/finish?err=state`)
  }
  const storeId = state.storeId || 'baegun'
  const finish = (q: string) => NextResponse.redirect(`${base}/store/${storeId}/auth/finish?${q}`)

  try {
    // ① 토큰 발급
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_REST_API_KEY!,
      redirect_uri: process.env.KAKAO_REDIRECT_URI!,
      code,
    })
    if (process.env.KAKAO_CLIENT_SECRET) body.set('client_secret', process.env.KAKAO_CLIENT_SECRET)
    const tok = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
    }).then(r => r.json()).catch(() => null)
    if (!tok?.access_token) return finish('err=token')

    // ② 사용자 정보 조회
    const me = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    }).then(r => r.json()).catch(() => null)
    const kakaoId = me?.id
    if (!kakaoId) return finish('err=profile')
    // 전화번호 패턴 마스킹 — 카카오 닉네임에 전화번호가 있어도 우리 DB(및 서명토큰)에 남지 않게. [개인정보 원칙]
    const nickname: string = sanitizeNickname(me?.kakao_account?.profile?.nickname || me?.properties?.nickname || '')
    const uidHash = oauthHash('kakao', kakaoId)

    // ③ 기존 users 매핑 조회
    const admin = adminClient()
    const { data: existing, error: lookErr } = await admin.from('users')
      .select('id, withdrawn_at')
      .eq('store_id', storeId).eq('auth_provider', 'kakao').eq('provider_uid', uidHash).maybeSingle()

    // [진단 로그] 실제 재로그인 시 provider_uid 조회가 기존 매핑을 찾는지 확인용.
    console.log('[kakao-callback]', JSON.stringify({
      kakaoId: String(kakaoId), kakaoIdType: typeof kakaoId,
      storeId, uidHashHead: uidHash.slice(0, 12),
      lookupError: lookErr?.message || null,
      existing: existing ? { id: existing.id, withdrawn: !!(existing as any).withdrawn_at } : null,
      branch: existing ? 'SESSION(메뉴 직행)' : 'PENDING(선택화면)',
    }))
    // [강화 진단] 콜백 클라이언트가 실제로 보는 것: 접속 URL/서비스키 유무/full 해시/카카오 행 전체+일치여부
    try {
      const rawAll = await admin.from('users').select('id, store_id, auth_provider, provider_uid').eq('auth_provider', 'kakao')
      console.log('[kakao-callback-raw]', JSON.stringify({
        supaUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace('https://', '').slice(0, 24),
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        serviceKeyLen: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length,
        fullUidHash: uidHash,
        rawErr: rawAll.error?.message || null,
        kakaoRows: (rawAll.data || []).map((u: any) => ({ id: u.id.slice(0, 8), store: u.store_id, uidHead: (u.provider_uid || '').slice(0, 16), match: u.provider_uid === uidHash })),
      }))
    } catch (e: any) { console.log('[kakao-callback-raw] ERR', e?.message) }

    if (existing) {
      // 재방문 로그인 — 탈퇴상태면 재활성화. (소셜 재활성화 시 탈퇴흔적 phone 잔재도 정리)
      const patch: Record<string, any> = { last_visit: new Date().toISOString() }
      if ((existing as any).withdrawn_at) { patch.withdrawn_at = null; patch.phone = null; patch.phone_encrypted = null }
      await admin.from('users').update(patch).eq('id', existing.id)
      const session = signToken({ t: 'session', uid: existing.id }, 300)
      return finish(`token=${encodeURIComponent(session)}`)
    }

    // 신규 소셜신원 — 아직 user 생성 안 함(연결/새로시작 선택 후 확정)
    const pending = signToken({ t: 'pending', provider: 'kakao', uidHash, nickname }, 600)
    return finish(`pending=${encodeURIComponent(pending)}&nickname=${encodeURIComponent(nickname)}`)
  } catch {
    return finish('err=server')
  }
}
