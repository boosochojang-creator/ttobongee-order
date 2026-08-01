'use client'
// [고객상태 통합] 모든 진입/안내 화면이 참조하는 단일 클라이언트 소스.
//   서버 /api/member/state 를 로그인(userId 확보) 시 1회 조회·캐시 → 화면마다 제각각 판단하던 것을 통일.
//   (재방문인데 신규화면 뜨던 버그의 근본 해소 지점 — 화면들은 이 훅만 본다.)
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useCart } from './cartStore'

export type MemberState = {
  identity: 'guest' | 'known'
  profile: 'incomplete' | 'complete'
  greeting: string | null
  banners: { profileHint: boolean }
  loading: boolean
  refresh: () => void
}

const GUEST: Omit<MemberState, 'refresh'> = {
  identity: 'guest', profile: 'incomplete', greeting: null, banners: { profileHint: false }, loading: false,
}

const Ctx = createContext<MemberState>({ ...GUEST, refresh: () => {} })

export function MemberStateProvider({ children }: { children: ReactNode }) {
  const { userId, hydrated } = useCart()
  const [state, setState] = useState<Omit<MemberState, 'refresh'>>({ ...GUEST, loading: true })

  const refresh = useCallback(() => {
    if (!userId) { setState({ ...GUEST }); return }
    setState(s => ({ ...s, loading: true }))
    fetch(`/api/member/state?userId=${userId}`)
      .then(r => r.json())
      .then(r => {
        if (r?.ok) setState({ identity: r.identity, profile: r.profile, greeting: r.greeting, banners: r.banners || { profileHint: false }, loading: false })
        else setState({ ...GUEST })
      })
      .catch(() => setState({ ...GUEST }))
  }, [userId])

  useEffect(() => { if (hydrated) refresh() }, [hydrated, refresh])

  return <Ctx.Provider value={{ ...state, refresh }}>{children}</Ctx.Provider>
}

export function useMemberState() {
  return useContext(Ctx)
}
