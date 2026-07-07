'use client'
// Phase 5-2-c-2: 공용 '한마디' (게시글+댓글). 오락실/음악감상실 공유 (자유게시판은 5-2-e에서 비밀글·사진 확장).
import { useEffect, useState } from 'react'
import { getMemberLocal } from './memberState'
import { BOARD_WARNING } from '../../lib/contentFilter'

type Post = { id: string; author_name: string; created_at: string; is_secret: boolean; comment_count: number; content: string | null; has_image: boolean }

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 60) return '방금'
  if (d < 3600) return `${Math.floor(d / 60)}분 전`
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`
  return `${Math.floor(d / 86400)}일 전`
}

export default function HanmadiSection({ source, title = '💬 한마디 남기기' }: { source: 'arcade' | 'music' | 'board'; title?: string }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [anon, setAnon] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [comments, setComments] = useState<any[]>([])
  const [cContent, setCContent] = useState('')
  const [cAnon, setCAnon] = useState(false)
  const [cErr, setCErr] = useState('')

  const userId = getMemberLocal()?.userId || null
  const load = () => fetch(`/api/board/posts?source=${source}`).then(x => x.json()).then(r => { if (r.ok) setPosts(r.posts) }).catch(() => {})
  useEffect(() => { load() }, [source]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!content.trim() || busy) return
    setBusy(true); setErr('')
    const r = await fetch('/api/board/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, content, anonymous: anon, userId }) }).then(x => x.json()).catch(() => null)
    setBusy(false)
    if (!r?.ok) { setErr(r?.error || '등록에 실패했어요'); return }
    setContent(''); load()
  }

  const openComments = async (id: string) => {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id); setComments([]); setCContent(''); setCErr('')
    const r = await fetch(`/api/board/comments?postId=${id}`).then(x => x.json())
    if (r.ok) setComments(r.comments)
  }
  const submitComment = async () => {
    if (!cContent.trim() || !openId) return
    setCErr('')
    const r = await fetch('/api/board/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: openId, content: cContent, anonymous: cAnon, userId }) }).then(x => x.json()).catch(() => null)
    if (!r?.ok) { setCErr(r?.error || '등록 실패'); return }
    setCContent('')
    const rr = await fetch(`/api/board/comments?postId=${openId}`).then(x => x.json())
    if (rr.ok) setComments(rr.comments)
    load()
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#f0f0f0', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#e0a03a', marginBottom: 8 }}>⚠️ {BOARD_WARNING}</div>
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="한마디 남겨보세요" rows={2}
        style={{ width: '100%', background: '#111', border: '1px solid #444', borderRadius: 10, padding: '10px 12px', color: '#eee', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#aaa', cursor: 'pointer' }}>
          <input type="checkbox" checked={anon} onChange={e => setAnon(e.target.checked)} style={{ accentColor: '#c8a900' }} /> 익명
        </label>
        <span style={{ fontSize: 11, color: '#666' }}>{anon ? '익명으로 등록' : '닉네임으로 등록 (없으면 자동 부여)'}</span>
        <button onClick={submit} disabled={busy} style={{ marginLeft: 'auto', background: '#c8a900', color: '#111', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{busy ? '등록 중' : '등록'}</button>
      </div>
      {err && <div style={{ color: '#e05555', fontSize: 13, marginTop: 6 }}>❌ {err}</div>}

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {posts.length === 0 && <div style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 16 }}>아직 한마디가 없어요. 첫 글을 남겨보세요!</div>}
        {posts.map(p => (
          <div key={p.id} style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 4 }}>
              <span style={{ color: '#c8a900', fontWeight: 700 }}>{p.author_name}</span>
              <span>{timeAgo(p.created_at)}</span>
            </div>
            <div style={{ fontSize: 14, color: '#eee', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.is_secret ? '🔒 비밀글입니다' : p.content}</div>
            <button onClick={() => openComments(p.id)} style={{ marginTop: 6, background: 'none', border: 'none', color: '#7fd4ff', fontSize: 12, cursor: 'pointer', padding: 0 }}>
              💬 댓글 {p.comment_count}{openId === p.id ? ' · 접기' : ''}
            </button>
            {openId === p.id && (
              <div style={{ marginTop: 8, borderTop: '1px solid #2a2a2a', paddingTop: 8 }}>
                {comments.map(c => (
                  <div key={c.id} style={{ padding: '5px 0', fontSize: 13 }}>
                    <span style={{ color: '#c8a900', fontWeight: 700, marginRight: 6 }}>{c.author_name}</span>
                    <span style={{ color: '#ddd' }}>{c.content}</span>
                  </div>
                ))}
                {comments.length === 0 && <div style={{ color: '#666', fontSize: 12 }}>첫 댓글을 남겨보세요</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input value={cContent} onChange={e => setCContent(e.target.value)} placeholder="댓글" style={{ flex: 1, background: '#111', border: '1px solid #444', borderRadius: 8, padding: '8px 10px', color: '#eee', fontSize: 13, boxSizing: 'border-box' }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#aaa' }}><input type="checkbox" checked={cAnon} onChange={e => setCAnon(e.target.checked)} style={{ accentColor: '#c8a900' }} />익명</label>
                  <button onClick={submitComment} style={{ background: '#333', color: '#eee', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>등록</button>
                </div>
                {cErr && <div style={{ color: '#e05555', fontSize: 12, marginTop: 4 }}>{cErr}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
