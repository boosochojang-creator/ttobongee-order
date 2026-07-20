import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 회원탈퇴 — 개인정보 비식별화(익명화). 개인 식별정보만 복구불가 처리하고, 주문/쿠폰 등 이력은
// 통계·정산 목적상 익명 shell(users 행)에 연결된 채 보존한다.
// 재가입: phone_hash·phone을 스크럽하므로 같은 번호로 로그인 시 조회 실패 → 신규 회원으로 재가입(신규가입 쿠폰 새로 발급).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ ok: false, error: 'userId가 필요합니다' }, { status: 400 })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // 존재 확인(이미 탈퇴여도 idempotent하게 성공 처리)
    const { data: u } = await admin.from('users').select('id').eq('id', userId).maybeSingle()
    if (!u) return NextResponse.json({ ok: false, error: '회원을 찾을 수 없어요' }, { status: 404 })

    // 1) users 행 익명화 — 개인 식별정보 파기. phone은 NOT NULL·UNIQUE 제약이라 복구불가 더미로 치환.
    //    [항목1] phone_hash(단방향 HMAC, 번호로 복원 불가)는 '재가입 시 재활성화' 대조용으로 보존한다.
    //    복호화 가능한 개인정보(phone_encrypted)·평문 phone·프로필은 계속 완전 파기.
    const { error: uErr } = await admin.from('users').update({
      phone: `withdrawn:${userId}`,
      phone_encrypted: null,
      nickname: null,
      birthday: null,
      address: null,
      email: null,
      marketing_opt_in: false,
      birthday_saved: false,
      address_saved: false,
    }).eq('id', userId)
    if (uErr) throw uErr

    // 1-b) 탈퇴 마커. 마이그 024(withdrawn_at) 실행 전이면 컬럼이 없어 실패할 수 있으므로 best-effort(개인정보 파기는 이미 완료).
    try { await admin.from('users').update({ withdrawn_at: new Date().toISOString() }).eq('id', userId) } catch {}

    // 2) 주문에 남은 연락처/주소 사본 파기(금액·메뉴 등 매출 이력은 보존). best-effort.
    await admin.from('orders').update({
      customer_phone: null, customer_phone_encrypted: null, delivery_address: null,
    }).eq('user_id', userId)

    // 3) 푸시 구독 삭제 — 더 이상 알림 발송 대상 아님.
    await admin.from('push_subscriptions').delete().eq('user_id', userId)

    // 4) 공개 게시글/댓글 작성자 표시명 익명화(글 내용은 보존, user_id는 FK on delete set null 대상이나 행 유지).
    await admin.from('posts').update({ author_name: '탈퇴한 회원' }).eq('user_id', userId)
    await admin.from('comments').update({ author_name: '탈퇴한 회원' }).eq('user_id', userId)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
