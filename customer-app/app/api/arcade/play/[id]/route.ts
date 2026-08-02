import { NextRequest, NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { adminClient } from '../../../../lib/supabaseAdmin'

// [항목5] 오락실 업로드 게임 실행 프록시.
//   Supabase Storage 공개 endpoint는 업로드된 HTML을 보안상 항상
//   `Content-Type: text/plain` + `CSP: default-src 'none'; sandbox` + nosniff 로 강제 서빙한다
//   (스토리지 도메인의 액티브 HTML 실행 차단). 그래서 iframe으로 열면 게임이 실행되지 않고
//   소스가 텍스트로 보였다. → 게임 바이트를 우리 오리진에서 text/html 로 다시 내려준다.
//   격리는 호출측 iframe sandbox(allow-scripts, same-origin 미허용=불투명 오리진)로 유지된다.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  noStore()
  try {
    const admin = adminClient()
    const { data: game } = await admin.from('arcade_games')
      .select('storage_url, is_active').eq('id', params.id).maybeSingle()
    if (!game || !game.is_active || !game.storage_url) {
      return new NextResponse('게임을 찾을 수 없어요', { status: 404 })
    }
    // 우리 DB에 저장된 우리 스토리지 URL만 프록시(오픈 프록시 방지)
    const res = await fetch(game.storage_url, { cache: 'no-store' })
    if (!res.ok) return new NextResponse('게임을 불러오지 못했어요', { status: 502 })
    const html = await res.text()
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e: any) {
    return new NextResponse('오류가 발생했어요', { status: 500 })
  }
}
