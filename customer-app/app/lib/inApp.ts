// 인앱 브라우저(카카오톡·네이버 등 앱 내장 웹뷰) 감지 + 외부 브라우저로 우회.
// 인앱 웹뷰에서는 홈화면 설치(PWA)·웹푸시 구독·알림이 막히거나 불안정하므로, 외부 브라우저(크롬/사파리)로 유도한다.
// 결제(포트원)는 이번 범위 밖(현재 비활성).

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  // 대표 인앱 웹뷰: 카카오톡/네이버(앱·인앱)/다음/밴드/인스타/페북/라인/에브리타임 등
  const inappHints = [
    'kakaotalk', 'naver(', 'naver ', 'inapp', 'daumapps', 'band', 'instagram',
    'fban', 'fbav', 'fb_iab', 'line/', 'everytimeapp', 'snapchat', 'trill', 'kakaostory',
  ]
  if (inappHints.some(h => ua.includes(h))) return true
  // 안드로이드 일반 WebView(; wv) — 단, 홈화면 설치(PWA standalone)로 실행된 경우는 제외
  if (/; wv\)/.test(ua)) {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true
    if (!standalone) return true
  }
  return false
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/.test(navigator.userAgent.toLowerCase())
}

// 안드로이드는 외부 브라우저로 자동 전환 가능(크롬 intent / 카카오·라인 전용 스킴). iOS는 자동 전환이 막혀 안내만.
export function canAutoEscape(): boolean {
  return isAndroid()
}

// 현재 URL을 외부 브라우저(크롬 등)에서 다시 열기. 안드로이드 전용(iOS는 안내 문구로 유도).
export function openInExternalBrowser(rawUrl?: string) {
  if (typeof window === 'undefined') return
  const url = rawUrl || window.location.href
  const ua = navigator.userAgent.toLowerCase()
  try {
    if (/kakaotalk/.test(ua)) {
      // 카카오톡 전용 — 외부 브라우저로 열기
      window.location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url)
      return
    }
    if (/line\//.test(ua)) {
      // 라인 — openExternalBrowser 파라미터
      window.location.href = url + (url.includes('?') ? '&' : '?') + 'openExternalBrowser=1'
      return
    }
    if (isAndroid()) {
      // 안드로이드 일반 웹뷰 — 크롬 intent로 강제 오픈
      const noScheme = url.replace(/^https?:\/\//, '')
      window.location.href = `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;end`
      return
    }
  } catch {}
}
