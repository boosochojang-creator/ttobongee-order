'use client'
// MP4 미니플레이어 — 재생 중인 영상이 화면 전환에도 끊기지 않도록, <video>를 레이아웃에 상주하는
// 전역 프로바이더가 소유한다(음악감상실 페이지가 소유하면 이동 시 언마운트→재생 중단).
//   · 음악감상실('/…/music')에 있으면 상단 풀사이즈로 표시
//   · 다른 화면으로 이동하면 우측 하단 미니플레이어로 자동 축소(재생은 계속)
//   · 미니플레이어 탭 → 음악감상실로 복귀(자동으로 풀사이즈)
//   · 미니 컨트롤: 일시정지/재생 · 닫기(정지). 직원호출 종 FAB(zIndex 201)와 겹치지 않는 위치.
// MP3(오디오만 재생)는 이 로직 대상이 아니라 음악감상실 페이지 로컬에서 재생한다.
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useStoreId } from './storeContext'

export type VideoTrack = { id: string; title: string; url: string }

type Ctx = {
  track: VideoTrack | null
  playing: boolean
  open: (t: VideoTrack) => void // 이 mp4를 전역 플레이어로 재생
  close: () => void             // 정지 + 플레이어 제거
  toggle: () => void            // 일시정지/재생
}

const VideoPlayerContext = createContext<Ctx>({
  track: null, playing: false, open: () => {}, close: () => {}, toggle: () => {},
})

// 풀/미니 높이는 16:9 고정 — 폭 기준으로 계산해 스페이서와 정확히 맞춘다.
const FULL_H = 'calc(min(100vw, 480px) * 0.5625)'
const MINI_W = 168
const MINI_H = Math.round(MINI_W * 0.5625) // ≈ 95

export function VideoPlayerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const storeId = useStoreId()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [track, setTrack] = useState<VideoTrack | null>(null)
  const [playing, setPlaying] = useState(false)

  const onMusicPage = !!pathname && pathname.endsWith('/music')

  const open = useCallback((t: VideoTrack) => {
    setTrack(t)
    const v = videoRef.current
    if (!v) return
    if (v.src !== t.url) v.src = t.url // src는 명령형으로 제어(React가 초기화하지 않게)
    v.play().catch(() => {})
  }, [])

  const close = useCallback(() => {
    const v = videoRef.current
    if (v) { v.pause(); v.removeAttribute('src'); try { v.load() } catch {} }
    setTrack(null); setPlaying(false)
  }, [])

  const toggle = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }, [])

  const expand = () => router.push(`/store/${storeId}/music`)

  const show = !!track
  const base: React.CSSProperties = {
    position: 'fixed', zIndex: 210, background: '#000', overflow: 'hidden',
    transition: 'all 0.28s cubic-bezier(0.4,0,0.2,1)',
  }
  const full: React.CSSProperties = {
    top: 52, left: '50%', transform: 'translateX(-50%)', // BackToOrder 헤더(약 52px) 아래로
    width: 'min(100vw, 480px)', height: FULL_H,
    borderRadius: '0 0 12px 12px', boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
  }
  const mini: React.CSSProperties = {
    right: 12, bottom: 156, transform: 'none', // 종 FAB(bottom:90,높이56)·담기바 위로 비켜 배치
    width: MINI_W, height: MINI_H,
    borderRadius: 12, border: '1.5px solid #c8a900', boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
  }
  const hidden: React.CSSProperties = {
    width: 0, height: 0, opacity: 0, pointerEvents: 'none', border: 'none',
  }

  return (
    <VideoPlayerContext.Provider value={{ track, playing, open, close, toggle }}>
      {children}
      <div style={{ ...base, ...(show ? (onMusicPage ? full : mini) : hidden) }}>
        <video
          ref={videoRef}
          playsInline
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', display: 'block' }}
        />
        {/* 미니플레이어 오버레이 — 탭하면 음악감상실로 복귀, 컨트롤은 이벤트 전파 차단 */}
        {show && !onMusicPage && (
          <div onClick={expand} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            }}>
              <button
                onClick={(e) => { e.stopPropagation(); toggle() }}
                aria-label={playing ? '일시정지' : '재생'}
                style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: 15, lineHeight: 1, padding: '4px 6px', borderRadius: 8, cursor: 'pointer' }}
              >
                {playing ? '⏸️' : '▶️'}
              </button>
              <span style={{ flex: 1, fontSize: 10, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {track?.title}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); close() }}
                aria-label="닫기"
                style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: 13, lineHeight: 1, padding: '4px 7px', borderRadius: 8, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </VideoPlayerContext.Provider>
  )
}

// 미니플레이어가 상단을 가리지 않도록 음악감상실 페이지가 확보할 스페이서 높이(풀사이즈와 동일).
export const VIDEO_FULL_HEIGHT = FULL_H

export function useVideoPlayer() {
  return useContext(VideoPlayerContext)
}
