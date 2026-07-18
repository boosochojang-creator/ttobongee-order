import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// [2] 웹푸시 구독 저장 — 클라이언트가 pushManager.subscribe 후 이 라우트로 전송.
// endpoint(기기당 1개)로 upsert. 회원(userId)과 매장(storeId) 연결.
export async function POST(req: NextRequest) {
  try {
    const { subscription, userId, storeId } = await req.json()
    const ep = subscription?.endpoint
    const p256dh = subscription?.keys?.p256dh
    const auth = subscription?.keys?.auth
    if (!ep || !p256dh || !auth) {
      return NextResponse.json({ ok: false, error: '구독 정보 누락' }, { status: 400 })
    }
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error } = await admin.from('push_subscriptions').upsert({
      store_id: storeId || 'baegun',
      user_id: userId || null,
      endpoint: ep, p256dh, auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
