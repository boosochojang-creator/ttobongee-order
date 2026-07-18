'use client'
// 멀티매장: 고객앱은 /store/[storeId]/... 경로로 매장을 구분한다(QR이 매장을 URL에 담음).
// 페이지·lib 컴포넌트 어디서든 prop drilling 없이 현재 매장 id를 얻기 위한 헬퍼.
import { usePathname } from 'next/navigation'

export const DEFAULT_STORE = process.env.NEXT_PUBLIC_DEFAULT_STORE || 'baegun'

// pathname('/store/baegun/menu' 등)에서 매장 id 추출. 매칭 실패 시 기본 매장.
export function getStoreIdFromPath(pathname: string | null | undefined): string {
  const m = (pathname || '').match(/^\/store\/([^/]+)/)
  return m ? decodeURIComponent(m[1]) : DEFAULT_STORE
}

// 클라이언트 컴포넌트용 훅 — 현재 URL 기준 매장 id.
export function useStoreId(): string {
  return getStoreIdFromPath(usePathname())
}
