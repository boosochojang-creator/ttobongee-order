import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 회원 추가정보 저장/프롬프트 추적 (그룹 B-2)
// users 테이블은 익명 키로 UPDATE가 막혀 있어(0건 무시) 서버에서 service role로 처리한다.

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// 상태 계산: 셋 다 비면 phone_member, 일부 입력 profile_incomplete, 전부 입력 profile_complete
function computeStatus(birthday: string, address: string, email: string) {
  const filled = [birthday, address, email].filter(v => (v || '').trim() !== '').length
  if (filled === 0) return 'phone_member'
  if (filled === 3) return 'profile_complete'
  return 'profile_incomplete'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, userId } = body
    if (!userId) return NextResponse.json({ ok: false, error: 'userId 누락' }, { status: 400 })
    const db = admin()

    if (action === 'save') {
      const birthday = (body.birthday || '').trim()
      const address = (body.address || '').trim()
      const email = (body.email || '').trim()
      const marketingOptIn = !!body.marketingOptIn
      const status = computeStatus(birthday, address, email)

      const { error } = await db.from('users').update({
        birthday: birthday || null,
        address: address || null,
        email: email || null,
        marketing_opt_in: marketingOptIn,
        birthday_saved: !!birthday,
        address_saved: !!address,
        member_status: status,
        ...(status === 'profile_complete' ? { profile_completed_at: new Date().toISOString() } : {}),
      }).eq('id', userId)
      if (error) throw error
      return NextResponse.json({ ok: true, status })
    }

    if (action === 'prompt_shown') {
      await db.from('users').update({ last_profile_prompt_shown_at: new Date().toISOString() }).eq('id', userId)
      return NextResponse.json({ ok: true })
    }

    if (action === 'prompt_dismiss') {
      await db.from('users').update({
        profile_prompt_dismissed_at: new Date().toISOString(),
        profile_prompt_dismiss_count: Number(body.count) || 1,
      }).eq('id', userId)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: '알 수 없는 action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
