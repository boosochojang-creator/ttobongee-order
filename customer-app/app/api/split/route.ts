import { NextRequest, NextResponse } from 'next/server'
import {
  startSession, claimShare, confirmShare, cancelShare,
  getSessionState, findActiveSessionByTable,
} from '../../../lib/splitPay'

// Phase 3: 더치페이 API — action 하나로 통합 (start / claim / confirm / cancel)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    switch (body.action) {
      case 'start':
        return NextResponse.json(await startSession(body.orderId, body.participantCount))
      case 'claim':
        return NextResponse.json(await claimShare(body.sessionId, body.memberUserId))
      case 'confirm':
        return NextResponse.json(await confirmShare(body.paymentId))
      case 'cancel':
        return NextResponse.json(await cancelShare(body.paymentId))
      default:
        return NextResponse.json({ ok: false, error: '알 수 없는 action' }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const sessionId = sp.get('sessionId')
    const table = sp.get('table')
    if (sessionId) return NextResponse.json(await getSessionState(sessionId))
    if (table) return NextResponse.json(await findActiveSessionByTable(Number(table)))
    return NextResponse.json({ ok: false, error: 'sessionId 또는 table 필요' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
