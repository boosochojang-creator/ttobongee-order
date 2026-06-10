'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'

const MUTE_KEY = 'bgm-muted'

type BgmCtx = {
  muted: boolean
  toggleMuted: () => void
  startBGM: () => void
}

const BgmContext = createContext<BgmCtx>({
  muted: false,
  toggleMuted: () => {},
  startBGM: () => {},
})

export function BgmProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const startedRef = useRef(false)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(MUTE_KEY) === '1') setMuted(true)
  }, [])

  const startBGM = useCallback(async () => {
    if (startedRef.current) return
    startedRef.current = true

    // BGM URL: Supabase Storage bgm 버킷 우선, 없으면 로컬 fallback
    let bgmUrl = '/bgm.mp3'
    try {
      const { data } = await supabase.from('stores').select('bgm_url').eq('id', 'baegun').single()
      if (data?.bgm_url) bgmUrl = data.bgm_url
    } catch {}

    try {
      const audio = new Audio(bgmUrl)
      audio.volume = 0.15
      audio.loop = true
      audioRef.current = audio
      if (sessionStorage.getItem(MUTE_KEY) !== '1') {
        await audio.play()
      }
    } catch {}
  }, [])

  const toggleMuted = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      sessionStorage.setItem(MUTE_KEY, next ? '1' : '0')
      const audio = audioRef.current
      if (audio) {
        if (next) audio.pause()
        else audio.play().catch(() => {})
      }
      return next
    })
  }, [])

  return (
    <BgmContext.Provider value={{ muted, toggleMuted, startBGM }}>
      {children}
    </BgmContext.Provider>
  )
}

export function useBgm() {
  return useContext(BgmContext)
}
