import { createClient } from '@supabase/supabase-js'

// 서비스롤 관리 클라이언트 — 반드시 이걸로 생성한다.
// ★ Next.js는 route handler 안의 fetch(=supabase-js 내부 fetch)를 Data Cache에 캐싱한다.
//   그 결과 "계정 없음"이던 첫 조회 결과가 같은 쿼리 URL로 캐시돼, 이후 계정이 생겨도
//   같은 조회가 캐시된 빈값을 돌려주는 버그가 났다(카카오 재로그인 시 기존 회원 미조회 → 매번 신규 처리).
//   cache:'no-store'로 supabase 쿼리를 항상 최신으로 강제해 이 캐시를 우회한다.
export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: (url: any, opts: any) => fetch(url, { ...opts, cache: 'no-store' }) },
    },
  )
}
