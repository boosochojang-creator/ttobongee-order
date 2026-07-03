import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VALID = new Set(['accepted', 'cooking', 'done', 'served', 'canceled', 'cash_pending', 'pending', 'paid'])

export async function POST(req: NextRequest) {
  try {
    const { order_id, status } = await req.json()
    if (!order_id || !VALID.has(status)) {
      return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
    }
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error } = await admin.from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', order_id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
