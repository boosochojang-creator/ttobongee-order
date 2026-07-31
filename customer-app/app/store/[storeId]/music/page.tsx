'use client'
// Phase 5-2-d: 음악감상실 — 등록된 곡 목록에서 골라 재생 + 한마디
//   · MP3 = 오디오만 재생(이 페이지 로컬 <audio>, 화면 나가면 정지). 미니플레이어 대상 아님.
//   · MP4 = 전역 VideoPlayerProvider로 재생(영상 표시 + 화면 이동 시 미니플레이어로 축소, 재생 유지).
import { useEffect, useRef, useState } from 'react'
import BackToOrder from '../../../lib/BackToOrder'
import HanmadiSection from '../../../lib/HanmadiSection'
import { useStoreId } from '../../../lib/storeContext'
import { useVideoPlayer, VIDEO_FULL_HEIGHT } from '../../../lib/VideoPlayerContext'

const isMp4 = (url: string) => /\.mp4(\?|$)/i.test(url || '')

export default function MusicPage() {
  const storeId = useStoreId()
  const vp = useVideoPlayer()
  const [tracks, setTracks] = useState<any[]>([])
  const [audioPlaying, setAudioPlaying] = useState<string | null>(null) // 로컬 mp3 재생중 track id
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetch(`/api/music/list?storeId=${storeId}`).then(x => x.json()).then(r => setTracks(r?.ok ? r.tracks : [])).catch(() => {})
    return () => { audioRef.current?.pause() } // mp3만 정리(mp4 전역 재생은 페이지를 떠나도 계속)
  }, [storeId])

  const toggle = (t: any) => {
    if (isMp4(t.url)) {
      // mp4 → 전역 비디오 플레이어. 로컬 mp3가 있으면 정지.
      audioRef.current?.pause(); setAudioPlaying(null)
      if (vp.track?.id === t.id) vp.toggle() // 같은 곡이면 일시정지/재생 토글
      else vp.open(t)                        // 다른 곡이면 새로 재생
      return
    }
    // mp3 → 로컬 오디오. 재생 중인 전역 영상이 있으면 정지.
    vp.close()
    const audio = audioRef.current
    if (!audio) return
    if (audioPlaying === t.id) { audio.pause(); setAudioPlaying(null); return }
    audio.src = t.url
    audio.play().then(() => setAudioPlaying(t.id)).catch(() => setAudioPlaying(null))
  }

  const isPlaying = (t: any) =>
    isMp4(t.url) ? (vp.track?.id === t.id && vp.playing) : (audioPlaying === t.id)

  return (
    <main>
      <BackToOrder title="🎵 음악감상실" />
      <audio ref={audioRef} onEnded={() => setAudioPlaying(null)} preload="none" />
      {/* 전역 풀사이즈 영상이 상단을 덮지 않도록 자리 확보 (mp4 재생 중일 때만) */}
      {vp.track && <div style={{ height: VIDEO_FULL_HEIGHT }} aria-hidden />}
      <div style={{ padding: '20px 16px 40px' }}>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>편하게 노래·영상 즐기며 기다려주세요 🎧</p>
        {tracks.length === 0 && <div style={{ color: '#888', textAlign: 'center', padding: 30 }}>등록된 음악이 없어요</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tracks.map(t => {
            const active = isPlaying(t)
            return (
              <button key={t.id} onClick={() => toggle(t)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: active ? '#1a2a1a' : '#1a1a1a', border: `1px solid ${active ? '#3ac47d' : '#333'}`, borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 26 }}>{active ? '⏸️' : '▶️'}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', flex: 1 }}>
                  {t.title}{isMp4(t.url) && <span style={{ fontSize: 11, color: '#c8a900', marginLeft: 6 }}>🎬 영상</span>}
                </span>
                {active && <span style={{ fontSize: 12, color: '#3ac47d', fontWeight: 700 }}>재생 중</span>}
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #2a2a2a' }}>
          <HanmadiSection source="music" />
        </div>
      </div>
    </main>
  )
}
