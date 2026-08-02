import { createClient } from '@supabase/supabase-js'

// 서비스롤 관리 클라이언트 — 최신 데이터 조회가 필요한 route는 이걸로 생성.
// ★ Next.js가 route handler의 fetch(supabase-js 내부)를 캐싱해 옛 결과가 재사용되던 버그 방지(재로그인 미인식 사례).
//   cache:'no-store'로 항상 최신 조회 강제.
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
