import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '../../lib/pushSend'

// [2] 주문 접수(영수증) 알림 — 알리고 SMS 대신 웹푸시로. (SMS는 당분간 미사용, 재활성화는 아래 sendSMS 참고)
// 회원(order.user_id) 구독이 있으면 push, 없으면 조용히 스킵(에러 아님).

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json()
    if (!orderId) {
      return NextResponse.json({ ok: false, error: '주문번호가 필요합니다' }, { status: 400 })
    }
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: order } = await admin
      .from('orders')
      .select('store_id, final_amount, order_type, table_no, user_id, order_items(name_snapshot, qty)')
      .eq('id', orderId)
      .single()
    if (!order) return NextResponse.json({ ok: false, error: '주문을 찾을 수 없습니다' }, { status: 404 })

    const items = (order.order_items as any[]) || []
    const tableLabel = order.order_type === 'takeout' ? '포장' : `${order.table_no}번 테이블`
    const itemSummary = items.map(i => `${i.name_snapshot}×${i.qty}`).join(', ')
    const storeId = order.store_id || 'baegun'

    const push = await sendPushToUser(admin, {
      storeId, userId: order.user_id,
      payload: {
        title: '🍗 주문이 접수됐어요!',
        body: `${tableLabel} · 합계 ${(order.final_amount || 0).toLocaleString()}원\n${itemSummary}\n조리 후 알려드릴게요 😊`,
        url: `/store/${storeId}/order-status?id=${orderId}`,
        tag: `order-${orderId}`,
      },
    })

    return NextResponse.json({ ok: true, sent: push.sent, skipped: push.skipped })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

/* [보존] 알리고 SMS 발송 — 재활성화 시 위 push 대신/병행 호출. 발신 IP 화이트리스트 등록 필요.
async function sendSMS(to: string, message: string) {
  const apiKey = process.env.ALIGO_API_KEY, userId = process.env.ALIGO_USER_ID, sender = process.env.ALIGO_SENDER
  if (!apiKey || !userId || !sender) return { ok: true, skipped: true }
  const form = new URLSearchParams()
  form.append('key', apiKey); form.append('user_id', userId); form.append('sender', sender)
  form.append('receiver', to.replace(/-/g, '')); form.append('msg', message)
  form.append('msg_type', 'LMS'); form.append('title', '또봉이통닭 백운역점 영수증')
  const res = await fetch('https://apis.aligo.in/send/', { method: 'POST', body: form })
  const data = await res.json()
  if (data.result_code !== '1') throw new Error(data.message)
  return { ok: true }
}
*/
