'use client'
// Phase 5-2-d: 음악감상실 — 등록된 곡 목록에서 골라 재생 + 한마디
import { useEffect, useRef, useState } from 'react'
import BackToOrder from '../../../lib/BackToOrder'
import HanmadiSection from '../../../lib/HanmadiSection'
import { useStoreId } from '../../../lib/storeContext'

export default function MusicPage() {
  const storeId = useStoreId()
  const [tracks, setTracks] = useState<any[]>([])
  const [playing, setPlaying] = useState<string | null>(null) // 재생중 track id
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetch(`/api/music/list?storeId=${storeId}`).then(x => x.json()).then(r => setTracks(r?.ok ? r.tracks : [])).catch(() => {})
    return () => { audioRef.current?.pause() }
  }, [storeId])

  const toggle = (t: any) => {
    const audio = audioRef.current
    if (!audio) return
    if (playing === t.id) { audio.pause(); setPlaying(null); return }
    audio.src = t.url
    audio.play().then(() => setPlaying(t.id)).catch(() => setPlaying(null))
  }

  return (
    <main>
      <BackToOrder title="🎵 음악감상실" />
      <audio ref={audioRef} onEnded={() => setPlaying(null)} preload="none" />
      <div style={{ padding: '20px 16px 40px' }}>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>편하게 노래 들으며 기다려주세요 🎧</p>
        {tracks.length === 0 && <div style={{ color: '#888', textAlign: 'center', padding: 30 }}>등록된 음악이 없어요</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tracks.map(t => (
            <button key={t.id} onClick={() => toggle(t)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: playing === t.id ? '#1a2a1a' : '#1a1a1a', border: `1px solid ${playing === t.id ? '#3ac47d' : '#333'}`, borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 26 }}>{playing === t.id ? '⏸️' : '▶️'}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', flex: 1 }}>{t.title}</span>
              {playing === t.id && <span style={{ fontSize: 12, color: '#3ac47d', fontWeight: 700 }}>재생 중</span>}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #2a2a2a' }}>
          <HanmadiSection source="music" />
        </div>
      </div>
    </main>
  )
}
