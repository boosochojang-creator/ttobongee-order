import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '../../../lib/supabaseAdmin'
import { phoneDecrypt, phoneDigits } from '../../../lib/phoneCrypto'

// [2026-10 주문카드 고객정보] 점주 주문카드에 '누가 시켰는지' 표시용 — 회원별 표시이름·전화 끝4자리·방문수.
// 전화번호는 암호화돼 있어 서버(서비스롤)에서만 풀고, 화면엔 끝 4자리만 내보낸다(전체 번호 비노출).
export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json().catch(() => ({}))
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ ok: true, customers: {} })
    const admin = adminClient()
    const { data, error } = await admin.from('users')
      .select('id, nickname, phone, phone_encrypted, visit_count, grade, customer_grade, auth_provider')
      .in('id', ids.slice(0, 200))
    if (error) throw error
    const customers: Record<string, { name: string; last4: string; visit_count: number; grade: string | null }> = {}
    for (const u of data || []) {
      let digits = ''
      try { digits = phoneDigits(u.phone || phoneDecrypt(u.phone_encrypted) || '') } catch {}
      const last4 = digits.length >= 4 ? digits.slice(-4) : ''
      const name = (u.nickname && String(u.nickname).trim())
        || (last4 ? `손님 ${last4}` : `${u.auth_provider === 'kakao' ? '카카오' : u.auth_provider === 'google' ? '구글' : u.auth_provider === 'naver' ? '네이버' : ''}손님 ${String(u.id).slice(0, 4).toUpperCase()}`)
      customers[u.id] = { name, last4, visit_count: u.visit_count || 0, grade: u.grade || null }
    }
    return NextResponse.json({ ok: true, customers })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
