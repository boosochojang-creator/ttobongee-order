import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '../../../lib/supabaseAdmin'
import { verifyToken } from '../../../lib/authToken'

// 콜백이 발급한 session 토큰(uid) 검증 → 회원정보 반환. 클라가 MEMBER_KEY 저장에 사용.
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    const v = verifyToken<{ t: string; uid: string }>(token)
    if (!v || v.t !== 'session') {
      return NextResponse.json({ ok: false, error: '세션이 만료됐어요. 다시 로그인해주세요' }, { status: 401 })
    }
    const admin = adminClient()
    const { data: user } = await admin.from('users')
      .select('id, grade, visit_count, nickname, member_status, withdrawn_at').eq('id', v.uid).maybeSingle()
    if (!user || (user as any).withdrawn_at) {
      return NextResponse.json({ ok: false, error: '회원 확인에 실패했어요' }, { status: 404 })
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
