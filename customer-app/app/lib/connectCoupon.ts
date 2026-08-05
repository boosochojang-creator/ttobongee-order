// 소셜 계정연결 보상 쿠폰 — 기존 전화회원이 카카오/구글/네이버 계정을 연결(link) 완료하면 1회 지급.
// "지금 연결하면 콜라/사이다 330ml 캔 중 택1" 정책. member/link 성공 시 호출. 서버 전용.
import type { SupabaseClient } from '@supabase/supabase-js'

const CONNECT_FREE_MENU = '콜라/사이다 330ml 캔 중 택1'

// 1인 1회 — 이미 connect 쿠폰 이력(어떤 상태든)이 있으면 재발급하지 않는다. best-effort(발급 실패가 연결을 막지 않음).
export async function issueConnectCoupon(admin: SupabaseClient, userId: string): Promise<void> {
  try {
    const { data: had } = await admin.from('coupons')
      .select('id').eq('user_id', userId).eq('type', 'connect').limit(1)
    if (had && had.length) return

    const now = new Date()
    const usableFrom = now // 연결 즉시 사용 가능(재방문 중 바로 쓰도록)
    const expiresAt = new Date(now.getTime() + 60 * 86400000) // 60일
    await admin.from('coupons').insert({
      user_id: userId, type: 'connect',
      discount_amount: 0,
      free_menu: CONNECT_FREE_MENU, free_qty: 1,
      min_order_amount: 0,
      status: 'active', issued_at: now.toISOString(),
      usable_from: usableFrom.toISOString(), expires_at: expiresAt.toISOString(),
    })
  } catch {}
}
