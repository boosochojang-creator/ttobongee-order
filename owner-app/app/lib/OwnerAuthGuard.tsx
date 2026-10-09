'use client'
// [플랫폼] 점주 출입증(서버 쿠키)이 없거나 만료돼 서버가 401을 주면 → 화면 로그인 기록을 지우고 PIN 화면으로.
//  (예전에 로그인해 둔 기기는 출입증이 없어서, 업데이트 후 처음 한 번 PIN을 다시 묻게 된다)
//  모든 fetch를 한곳에서 지켜보므로 화면 코드마다 따로 처리하지 않아도 된다. 운영자(/admin)는 자체 처리라 제외.
import { useEffect } from 'react'

const AUTH_KEYS = ['platform-owner-auth-until', 'ttobongee-owner-auth-until']

export default function OwnerAuthGuard() {
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return
    const orig = window.fetch
    let fired = false
    window.fetch = async (input, init) => {
      const res = await orig(input, init)
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        const path = new URL(url, location.origin)
        if (res.status === 401 && path.origin === location.origin && path.pathname.startsWith('/api/') && !path.pathname.startsWith('/api/admin/') && !fired) {
          const had = AUTH_KEYS.some(k => { try { return !!localStorage.getItem(k) } catch { return false } })
          if (had) {
            fired = true
            AUTH_KEYS.forEach(k => { try { localStorage.removeItem(k) } catch {} })
            location.reload()
          }
        }
      } catch {}
      return res
    }
    return () => { window.fetch = orig }
  }, [])
  return null
}
