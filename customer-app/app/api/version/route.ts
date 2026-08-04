import { NextResponse } from 'next/server'

// [PWA 자동 반영] 현재 배포된 서버의 커밋 SHA를 런타임에 반환.
//   클라이언트가 자신이 빌드된 NEXT_PUBLIC_BUILD_ID와 비교해 새 배포를 감지한다.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  return NextResponse.json(
    { id: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
