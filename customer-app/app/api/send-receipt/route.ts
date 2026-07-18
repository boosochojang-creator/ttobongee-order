import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { phoneDecrypt, phoneDigits } from '../../lib/phoneCrypto'

// ===== 알리고 SMS 발송 (환경변수 등록 후 활성화) =====
// ALIGO_API_KEY   : 알리고 API 키
// ALIGO_USER_ID  : 알리고 아이디
// ALIGO_SENDER   : 발신번호 (예: 03222999848)

async function sendSMS(to: string, message: string) {
  const apiKey = process.env.ALIGO_API_KEY
  const userId = process.env.ALIGO_USER_ID
  const sender = process.env.ALIGO_SENDER

  if (!apiKey || !userId || !sender) {
    console.warn('[send-receipt] 알리고 환경변수 미설정 — SMS 발송 건너뜀')
    return { ok: true, skipped: true }
  }

  const form = new URLSearchParams()
  form.append('key', apiKey)
  form.append('user_id', userId)
  form.append('sender', sender)
  form.append('receiver', to.replace(/-/g, ''))
  form.append('msg', message)
  form.append('msg_type', 'LMS')
  form.append('title', '또봉이통닭 백운역점 영수증')

  const res = await fetch('https://apis.aligo.in/send/', {
    method: 'POST',
    body: form,
  })
  const data = await res.json()
  console.log('[send-receipt] Aligo 응답:', JSON.stringify(data))
  if (data.result_code !== '1') throw new Error(data.message)
  return { ok: true }
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, phone } = await req.json()
    // E2: 발송번호는 DB 복호화로 확정하므로 클라이언트 phone은 폴백(선택). orderId만 필수.
    const cleanPhone = (phone || '').replace(/-/g, '').trim()
    if (!orderId) {
      return NextResponse.json({ ok: false, error: '주문번호가 필요합니다' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 주문 정보 조회 (+ 복호화용 회원/주문 전화 암호)
    const { data: order } = await admin
      .from('orders')
      .select('final_amount, payment_method, order_type, table_no, created_at, user_id, customer_phone_encrypted, order_items(name_snapshot, qty, subtotal)')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ ok: false, error: '주문을 찾을 수 없습니다' }, { status: 404 })

    // E2: 발송 번호는 DB 복호화로 확정(클라이언트가 넘긴 값은 폴백만). 회원 phone_encrypted 우선, 없으면 주문 customer_phone_encrypted.
    let receiver = cleanPhone
    if (order.user_id) {
      const { data: mem } = await admin.from('users').select('phone_encrypted').eq('id', order.user_id).single()
      const dec = phoneDecrypt(mem?.phone_encrypted)
      if (dec) receiver = dec
    } else if (order.customer_phone_encrypted) {
      const dec = phoneDecrypt(order.customer_phone_encrypted)
      if (dec) receiver = dec
    }
    receiver = phoneDigits(receiver)
    if (receiver.length < 10) return NextResponse.json({ ok: false, error: '발송할 전화번호를 찾을 수 없습니다' }, { status: 400 })

    const items = (order.order_items as any[]) || []
    const payLabel: Record<string, string> = { card: '카드', kakao: '카카오페이', toss: '토스페이', cash: '현금' }
    const tableLabel = order.order_type === 'takeout' ? '포장' : `${order.table_no}번 테이블`
    const dateStr = new Date(order.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

    const lines = [
      `[또봉이통닭 백운역점]`,
      `주문이 접수되었습니다 🍗`,
      `주문번호: ${orderId.slice(0, 8).toUpperCase()}`,
      `${dateStr} ${tableLabel}`,
      `─────────────────`,
      ...items.map(i => `${i.name_snapshot} × ${i.qty}  ${i.subtotal.toLocaleString()}원`),
      `─────────────────`,
      `합계: ${order.final_amount.toLocaleString()}원`,
      `결제: ${payLabel[order.payment_method] || order.payment_method}`,
      `─────────────────`,
      `조리 후 알려드릴게요!`,
      `감사합니다 😊`,
      `문의: 032-299-9848`,
    ]

    const message = lines.join('\n')
    const result = await sendSMS(receiver, message)

    return NextResponse.json({ ok: true, skipped: result.skipped })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
