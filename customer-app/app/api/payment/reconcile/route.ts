import { NextResponse } from 'next/server'
import { reconcilePendingOrders } from '../../../../lib/paymentConfirm'

// 그룹 D: 웹훅 유실 대비 백업 재조회
// 생성 후 2분~24시간 지난 '대기(pending)' 주문을 포트원에 직접 재조회해 확정/정리한다.
// 호출 경로: ① Vercel Cron(vercel.json) ② 웹훅 수신 때마다 소량 동반 청소
// 멱등(여러 번 실행해도 안전)이며 포트원 재조회 결과 외에는 아무것도 신뢰하지 않는다.

export async function GET() {
  try {
    const r = await reconcilePendingOrders(20)
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
