import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { orderId, paymentId, expectedAmount } = await req.json()

    if (!orderId || !paymentId || !expectedAmount) {
      return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
    }

    // PortOne V2 결제 조회
    const portoneRes = await fetch(
      `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `PortOne ${process.env.PORTONE_V2_API_SECRET}` } }
    )

    if (!portoneRes.ok) {
      const body = await portoneRes.text()
      return NextResponse.json({ ok: false, error: `PortOne 조회 실패: ${body}` }, { status: 500 })
    }

    const payment = await portoneRes.json()

    // 결제 상태 검증
    if (payment.status !== 'PAID') {
      return NextResponse.json(
        { ok: false, error: `결제가 완료되지 않았습니다 (상태: ${payment.status})` },
        { status: 400 }
      )
    }

    // 금액 위변조 검증
    if (payment.amount?.total !== expectedAmount) {
      return NextResponse.json(
        { ok: false, error: `결제 금액 불일치 (실제: ${payment.amount?.total}, 기대: ${expectedAmount})` },
        { status: 400 }
      )
    }

    // Supabase 주문 상태 업데이트
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await admin
      .from('orders')
      .update({ status: 'paid', payment_id: paymentId })
      .eq('id', orderId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
