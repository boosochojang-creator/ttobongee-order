// PWA 설치 관련 공용 상태 모듈
// beforeinstallprompt는 페이지당 1회만 발생하므로 전역에서 한 번 붙잡아 두고,
// 설치 배너(PWAPrompt)와 회원가입 완료 흐름(login)이 같이 꺼내 쓴다.

export const INSTALLED_KEY = 'pwa-installed'
export const LATER_KEY = 'pwa-later-until'
// B-1 선행분: 가입 여부 최소 상태값 (이후 그룹 B-1에서 체계 확장 예정)
export const MEMBER_KEY = 'ttobongee-member-v1'

let deferredPrompt: any = null
let captured = false

export function initPwaCapture() {
  if (captured || typeof window === 'undefined') return
  captured = true
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt = e
  })
  window.addEventListener('appinstalled', () => {
    markInstalled()
    deferredPrompt = null
  })
}

export function getDeferredPrompt() { return deferredPrompt }
export function clearDeferredPrompt() { deferredPrompt = null }

export function isIOS() {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())
}

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true
}

export function isInstalled() {
  try { return isStandalone() || localStorage.getItem(INSTALLED_KEY) === '1' } catch { return false }
}

export function markInstalled() {
  try { localStorage.setItem(INSTALLED_KEY, '1') } catch {}
}

export function isLaterActive() {
  try {
    const t = Number(localStorage.getItem(LATER_KEY) || 0)
    return t > 0 && Date.now() < t
  } catch { return false }
}

export function setLater(days = 7) {
  try { localStorage.setItem(LATER_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000)) } catch {}
}

export function getMember(): { userId: string; phone: string } | null {
  try {
    const raw = localStorage.getItem(MEMBER_KEY)
    if (!raw) return null
    const m = JSON.parse(raw)
    return m && m.userId ? m : null
  } catch { return null }
}

export function setMemberFlag(userId: string, phone: string) {
  try { localStorage.setItem(MEMBER_KEY, JSON.stringify({ userId, phone, joinedAt: Date.now() })) } catch {}
}
