'use client'
// 어뷰징 방지 보조 신호용 기기 식별자(브라우저 localStorage UUID). 개인정보처리방침에 '중복가입 방지 목적' 고지 필요.
// 약한 신호(재설치/삭제 시 초기화) — 계정(provider_uid)이 1차, device_id는 보조.
const KEY = 'ttobongee-device-id'

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = (crypto as any)?.randomUUID?.() || `d_${Date.now()}_${Math.random().toString(36).slice(2)}`
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return ''
  }
}
