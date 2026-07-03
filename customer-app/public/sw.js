// 또봉이 주문 서비스워커 — PWA 설치 조건 충족용 최소 구현.
// 아이콘·manifest 같은 정적 파일만 캐시하고, 그 외 모든 요청(페이지·API·결제)은
// 절대 가로채지 않는다. 결제 흐름에 영향을 주지 않기 위한 의도적 제한이다.
const CACHE_NAME = 'ttobongee-static-v2'
const STATIC_ASSETS = ['/icon-192.png', '/icon-512.png', '/manifest.json']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  )
})

// 이전 버전 캐시(오래된 아이콘 포함)는 활성화 시점에 전부 삭제
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  const isStatic = url.origin === self.location.origin && STATIC_ASSETS.includes(url.pathname)
  if (e.request.method !== 'GET' || !isStatic) return // 정적 파일 외에는 관여하지 않음
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone()
      caches.open(CACHE_NAME).then((c) => c.put(e.request, copy))
      return res
    }))
  )
})
