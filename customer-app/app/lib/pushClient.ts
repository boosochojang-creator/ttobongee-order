'use client'
// [2] 웹푸시 구독(클라이언트). 알림 권한 요청 → pushManager 구독 → 서버 저장.
// 실패/미지원/권한거부는 조용히 false 반환(에러로 처리 안 함).

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export async function subscribeToPush(userId: string, storeId: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!pub) return false

    // 알림 권한 (거부면 조용히 종료)
    let perm = Notification.permission
    if (perm === 'default') perm = await Notification.requestPermission()
    if (perm !== 'granted') return false

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(pub),
      })
    }
    const res = await fetch('/api/push/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), userId, storeId }),
    }).then(r => r.json()).catch(() => null)
    return !!res?.ok
  } catch {
    return false
  }
}
