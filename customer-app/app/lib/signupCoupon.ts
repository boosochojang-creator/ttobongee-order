// 신규가입 signup 쿠폰 즉시 발급 (서버 전용). member/auth(전화가입)·member/social-new(소셜 신규) 공용.
// 규칙은 owner coupons.ts COUPON_RULES.signup과 동일: 무기한 · 다음날부터 사용(당일 사용불가) · 최소주문 0.
import type { SupabaseClient } from '@supabase/supabase-js'

const SIGNUP_FREE_MENU = '생맥주 500cc / 소주 1병 / 음료(대) 중 택1'

export async function issueSignupCoupon(admin: SupabaseClient, userId: string): Promise<void> {
  try {
    const now = new Date()
    const kst = new Date(now.getTime() + 9 * 3600 * 1000)
    const usableFrom = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1, 0, 0, 0) - 9 * 3600 * 1000) // 다음 KST 자정
    const expiresAt = new Date(now.getTime() + 100 * 365 * 86400000) // 무기한(validDays:null → 100년)
    await admin.from('coupons').insert({
      user_id: userId, type: 'signup',
      discount_amount: 0,
      free_menu: SIGNUP_FREE_MENU, free_qty: 1,
      min_order_amount: 0,
      status: 'active', issued_at: now.toISOString(),
      usable_from: usableFrom.toISOString(), expires_at: expiresAt.toISOString(),
    })
  } catch {}
}
