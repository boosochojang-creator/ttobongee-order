'use client'
// Phase 5-2-c-2/e-1: 공용 '한마디/게시판' (게시글+댓글). arcade/music=공개, board=비밀글·사진 지원.
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

// 사진 압축 (최대변 1000px, JPEG 0.7) → data URL
function compressImage(file: File, maxDim = 1000, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      if (width >= height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim }
      else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 로드 실패')) }
    img.src = url
  })
}

export default function HanmadiSection({ source, title = '💬 한마디 남기기', board = false }: { source: 'arcade' | 'music' | 'board'; title?: string; board?: boolean }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [anon, setAnon] = useState(false)
  const [secret, setSecret] = useState(false)
  const [secretPw, setSecretPw] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [comments, setComments] = useState<any[]>([])
  const [cContent, setCContent] = useState('')
  const [cAnon, setCAnon] = useState(false)
  const [cErr, setCErr] = useState('')
  // 비밀글 재조회 상태
  const [revealed, setRevealed] = useState<Record<string, { content: string; imageUrl: string | null }>>({})
  const [revealPw, setRevealPw] = useState<Record<string, string>>({})
  const [revealErr, setRevealErr] = useState<Record<string, string>>({})

  const userId = getMemberLocal()?.userId || null
  const load = () => fetch(`/api/board/posts?source=${source}`).then(x => x.json()).then(r => { if (r.ok) setPosts(r.posts) }).catch(() => {})
  useEffect(() => { load() }, [source]) // eslint-disable-line react-hooks/exhaustive-deps

  const pickImage = async (file?: File) => {
    if (!file) return
    try { setImageData(await compressImage(file)) } catch { setErr('사진 처리에 실패했어요') }
  }

  const submit = async () => {
    if (!content.trim() || busy) return
    if (board && secret && secretPw.trim().length < 2) { setErr('비밀번호를 2자 이상 입력해주세요'); return }
    setBusy(true); setErr('')
    const body: any = { source, content, anonymous: anon, userId }
    if (board && secret) { body.is_secret = true; body.secret_pw = secretPw; if (imageData) body.image = imageData }
    const r = await fetch('/api/board/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => null)
    setBusy(false)
    if (!r?.ok) { setErr(r?.error || '등록에 실패했어요'); return }
    setContent(''); setSecret(false); setSecretPw(''); setImageData(null); load()
  }

  const reveal = async (id: string) => {
    const r = await fetch('/api/board/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: id, password: revealPw[id] || '' }) }).then(x => x.json()).catch(() => null)
    if (!r?.ok) { setRevealErr(e => ({ ...e, [id]: r?.error || '조회 실패' })); return }
    setRevealed(v => ({ ...v, [id]: { content: r.content, imageUrl: r.imageUrl } }))
    setRevealErr(e => ({ ...e, [id]: '' }))
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

  const inp: React.CSSProperties = { background: '#111', border: '1px solid #444', borderRadius: 8, padding: '9px 11px', color: '#eee', fontSize: 14, boxSizing: 'border-box' }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#f0f0f0', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#e0a03a', marginBottom: 8 }}>⚠️ {BOARD_WARNING}</div>
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="내용을 남겨보세요" rows={3}
        style={{ ...inp, width: '100%', resize: 'vertical' }} />

      {board && (
        <div style={{ marginTop: 8, background: '#161616', border: '1px solid #2a2a2a', borderRadius: 10, padding: '10px 12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#ddd', cursor: 'pointer' }}>
            <input type="checkbox" checked={secret} onChange={e => setSecret(e.target.checked)} style={{ accentColor: '#c8a900' }} /> 🔒 비밀글로 쓰기 (점주만 열람, 나는 비번으로 재조회)
          </label>
          {secret && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="password" placeholder="비밀번호 (2자 이상)" value={secretPw} onChange={e => setSecretPw(e.target.value)} style={inp} />
              <label style={{ fontSize: 13, color: '#aaa', cursor: 'pointer' }}>
                📷 사진 첨부 (선택)
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pickImage(e.target.files?.[0])} />
                <span style={{ color: '#7fd4ff', marginLeft: 8 }}>{imageData ? '사진 선택됨' : '파일 선택'}</span>
              </label>
              {imageData && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={imageData} alt="첨부" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />
                  <button onClick={() => setImageData(null)} style={{ background: 'none', border: '1px solid #555', color: '#aaa', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>사진 제거</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#aaa', cursor: 'pointer' }}>
          <input type="checkbox" checked={anon} onChange={e => setAnon(e.target.checked)} style={{ accentColor: '#c8a900' }} /> 익명
        </label>
        <span style={{ fontSize: 11, color: '#666' }}>{anon ? '익명 등록' : '닉네임 등록(없으면 자동)'}</span>
        <button onClick={submit} disabled={busy} style={{ marginLeft: 'auto', background: '#c8a900', color: '#111', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{busy ? '등록 중' : '등록'}</button>
      </div>
      {err && <div style={{ color: '#e05555', fontSize: 13, marginTop: 6 }}>❌ {err}</div>}

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {posts.length === 0 && <div style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 16 }}>아직 글이 없어요. 첫 글을 남겨보세요!</div>}
        {posts.map(p => {
          const rv = revealed[p.id]
          return (
            <div key={p.id} style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 4 }}>
                <span style={{ color: '#c8a900', fontWeight: 700 }}>{p.author_name}</span>
                <span>{timeAgo(p.created_at)}</span>
              </div>
              {p.is_secret && !rv ? (
                <div>
                  <div style={{ fontSize: 14, color: '#aaa' }}>🔒 비밀글입니다</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <input type="password" placeholder="비밀번호" value={revealPw[p.id] || ''} onChange={e => setRevealPw(v => ({ ...v, [p.id]: e.target.value }))} style={{ ...inp, flex: 1, padding: '7px 10px', fontSize: 13 }} />
                    <button onClick={() => reveal(p.id)} style={{ background: '#333', color: '#eee', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer' }}>보기</button>
                  </div>
                  {revealErr[p.id] && <div style={{ color: '#e05555', fontSize: 12, marginTop: 4 }}>{revealErr[p.id]}</div>}
                </div>
              ) : (
                <div style={{ fontSize: 14, color: '#eee', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {rv ? rv.content : p.content}
                  {rv?.imageUrl && <img src={rv.imageUrl} alt="첨부" style={{ display: 'block', maxWidth: '100%', borderRadius: 10, marginTop: 8 }} />}
                </div>
              )}
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
                    <input value={cContent} onChange={e => setCContent(e.target.value)} placeholder="댓글" style={{ ...inp, flex: 1, padding: '8px 10px', fontSize: 13 }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#aaa' }}><input type="checkbox" checked={cAnon} onChange={e => setCAnon(e.target.checked)} style={{ accentColor: '#c8a900' }} />익명</label>
                    <button onClick={submitComment} style={{ background: '#333', color: '#eee', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>등록</button>
                  </div>
                  {cErr && <div style={{ color: '#e05555', fontSize: 12, marginTop: 4 }}>{cErr}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
