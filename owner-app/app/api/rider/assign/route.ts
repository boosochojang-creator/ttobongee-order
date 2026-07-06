import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Phase 5-1-a: 주문에 라이더 배정/해제 (서비스롤).
export async function POST(req: NextRequest) {
  try {
    const { order_id, rider_id } = await req.json()
    if (!order_id) return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error } = await admin.from('orders')
      .update({ rider_id: rider_id || null, updated_at: new Date().toISOString() })
      .eq('id', order_id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
