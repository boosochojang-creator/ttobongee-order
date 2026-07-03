import { NextRequest, NextResponse } from 'next/server'
import { confirmPayment } from '../../../../lib/paymentConfirm'

// 손님 복귀 시점의 결제 확인 (그룹 D에서 공용 확정 로직으로 교체)
// 금액 대조 기준은 클라이언트가 보낸 값이 아니라 DB에 저장된 주문 금액이다.
// (요청의 expectedAmount는 하위 호환을 위해 받기만 하고 신뢰하지 않음)

export async function POST(req: NextRequest) {
  try {
    const { orderId, paymentId } = await req.json()
    if (!orderId) {
      return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
    }

    const r = await confirmPayment(orderId, paymentId || orderId)

    switch (r.result) {
      case 'paid':
      case 'already_final':
        return NextResponse.json({ ok: true })
      case 'not_paid':
        return NextResponse.json(
          { ok: false, error: `결제가 완료되지 않았습니다 (상태: ${r.pgStatus})` }, { status: 400 })
      case 'not_found':
        return NextResponse.json(
          { ok: false, error: 'PortOne 조회 실패: PAYMENT_NOT_FOUND (결제 내역 없음)' }, { status: 400 })
      case 'mismatch':
        return NextResponse.json(
          { ok: false, error: `결제 금액 불일치 (실제: ${r.paidAmount}, 주문: ${r.orderAmount}) — 직원에게 문의해주세요` }, { status: 400 })
      case 'order_missing':
        return NextResponse.json({ ok: false, error: '주문을 찾을 수 없습니다' }, { status: 404 })
      default:
        return NextResponse.json({ ok: false, error: r.message || '검증 오류' }, { status: 500 })
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
