/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // [PWA 자동 반영] 배포마다 바뀌는 커밋 SHA를 빌드에 각인 → 실행 중인 코드의 버전.
  //   /api/version(런타임)과 비교해 새 배포를 감지한다. 로컬(미설정)은 'dev'라 감지 비활성.
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
};

module.exports = nextConfig;
