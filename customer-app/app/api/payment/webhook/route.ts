import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { confirmPayment, reconcilePendingOrders } from '../../../../lib/paymentConfirm'

// 그룹 D: 포트원 V2 웹훅 수신
// 포트원이 결제 완료/실패/취소 시점에 서버로 직접 쏘는 알림을 받아, 서버가 재조회 후 주문을 최종 확정한다.
// 서명 검증(표준 웹훅 방식: webhook-id/timestamp/signature 헤더 + whsec_ 시크릿)으로 위조 요청을 차단한다.

const TOLERANCE_SEC = 5 * 60 // 타임스탬프 허용 오차 5분 (재전송 공격 방지)

function verifySignature(rawBody: string, id: string | null, timestamp: string | null, sigHeader: string | null): boolean {
  const secret = process.env.PORTONE_WEBHOOK_SECRET
  if (!secret || !id || !timestamp || !sigHeader) return false

  const ts = Number(timestamp)
  if (!ts || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SEC) return false

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = crypto.createHmac('sha256', key)
    .update(`${id}.${timestamp}.${rawBody}`).digest('base64')

  // 헤더 형식: "v1,서명 v1,서명2 ..." — 하나라도 일치하면 유효
  return sigHeader.split(' ').some(part => {
    const sig = part.startsWith('v1,') ? part.slice(3) : part
    try {
      const a = Buffer.from(sig, 'base64')
      const b = Buffer.from(expected, 'base64')
      return a.length === b.length && crypto.timingSafeEqual(a, b)
    } catch { return false }
  })
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.PORTONE_WEBHOOK_SECRET) {
      // 시크릿 미설정 상태에서는 아무 요청도 처리하지 않음 (콘솔에서 웹훅 등록 후 env 설정 필요)
      return NextResponse.json({ ok: false, error: '웹훅 시크릿 미설정' }, { status: 503 })
    }

    const rawBody = await req.text()
    const valid = verifySignature(
      rawBody,
      req.headers.get('webhook-id'),
      req.headers.get('webhook-timestamp'),
      req.headers.get('webhook-signature'),
    )
    if (!valid) {
      return NextResponse.json({ ok: false, error: '서명 검증 실패' }, { status: 401 })
    }

    const event = JSON.parse(rawBody)
    const paymentId: string | undefined = event?.data?.paymentId

    let result = 'ignored'
    if (typeof event?.type === 'string' && event.type.startsWith('Transaction.') && paymentId) {
      // 일반 주문: 이벤트 종류와 무관하게 포트원 재조회 결과만 믿는다 (paymentId = 주문 id)
      // (더치페이는 결제자 1명 전액결제 방식으로 재설계되어 별도 몫(spl_) 결제 분기가 사라짐 — [10])
      const r = await confirmPayment(paymentId, paymentId)
      result = r.result
    }

    // 웹훅이 올 때마다 오래된 대기 주문도 함께 청소 (웹훅 유실 백업의 상시 트리거)
    const sweep = await reconcilePendingOrders(10).catch(() => null)

    return NextResponse.json({ ok: true, result, sweep })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
