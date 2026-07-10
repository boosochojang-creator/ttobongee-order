'use client'
// 추가정보 입력/수정 화면 (그룹 B-2) — 생일·주소·이메일 전부 선택 입력, 마케팅 동의는 별도.
// 동의 안 해도 저장·주문 가능. profile_complete 회원은 이 화면에서만 수정.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import LegalFooter from '../../../lib/LegalFooter'
import { getMemberLocal, updateMemberLocal } from '../../../lib/memberState'

export default function ProfilePage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [birthday, setBirthday] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [marketing, setMarketing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  // [2] 내 쿠폰함
  type Coupon = { id: string; reason: string; emoji: string; discount_amount: number; min_order_amount: number; issued_at: string; expires_at: string; state: 'usable' | 'used' | 'expired' }
  const [coupons, setCoupons] = useState<Coupon[] | null>(null)

  useEffect(() => {
    const m = getMemberLocal()
    if (!m) { router.replace('/store/baegun/login'); return }
    // 내 쿠폰함 로드 (실패해도 프로필 화면엔 영향 없음)
    fetch(`/api/coupons/list?userId=${m.userId}`).then(r => r.json())
      .then(r => setCoupons(r?.ok ? r.coupons : [])).catch(() => setCoupons([]))
    supabase.from('users')
      .select('nickname, birthday, address, email, marketing_opt_in')
      .eq('id', m.userId).single()
      .then(({ data }) => {
        if (data) {
          setNickname(data.nickname || '')
          setBirthday(data.birthday || '')
          setAddress(data.address || '')
          setEmail(data.email || '')
          setMarketing(!!data.marketing_opt_in)
        }
        setLoaded(true)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    const m = getMemberLocal()
    if (!m) return
    setLoading(true)
    setError('')
    // users 테이블은 익명 키로 직접 UPDATE가 안 되므로(0건 무시) 서버 API 경유로 저장
    const res = await fetch('/api/member-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save', userId: m.userId,
        nickname, birthday, address, email, marketingOptIn: marketing,
      }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    setLoading(false)
    if (!data?.ok) { setError('저장 중 오류가 발생했어요. 다시 시도해주세요'); return }
    updateMemberLocal({ status: data.status, marketingOptIn: marketing })
    setSaved(true)
    setTimeout(() => router.back(), 1200)
  }

  return (
    <main>
      <div className="top-bar">
        <button onClick={() => router.back()} style={{ background: 'none', fontSize: 22, color: 'var(--text)' }}>←</button>
        <span style={{ fontWeight: 700 }}>내 정보</span>
      </div>
      <div style={{ padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* [2] 내 쿠폰함 */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#f0f0f0', marginBottom: 4 }}>🎟️ 내 쿠폰함</div>
          <div style={{ fontSize: 12, color: '#777', marginBottom: 10 }}>결제는 카운터에서 진행되며, 쿠폰 할인은 주문 시 자동 안내돼요.</div>
          {coupons === null ? (
            <div style={{ color: '#888', fontSize: 13, padding: '14px 0' }}>쿠폰을 불러오는 중…</div>
          ) : coupons.length === 0 ? (
            <div style={{ color: '#888', fontSize: 13, background: '#141414', border: '1px solid #2a2a2a', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
              아직 받은 쿠폰이 없어요. 방문하시면 다양한 혜택 쿠폰을 드려요 💛
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {coupons.map(c => <CouponCard key={c.id} c={c} />)}
            </div>
          )}
        </div>

        <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, borderTop: '1px solid #2a2a2a', paddingTop: 16 }}>
          생일·주소를 추가하면 <span style={{ color: '#FFD700', fontWeight: 700 }}>생일쿠폰</span>과{' '}
          <span style={{ color: '#FFD700', fontWeight: 700 }}>배달 주문</span>을 더 편하게 이용할 수 있어요.
          <br />모든 항목은 선택 입력입니다.
        </div>

        {!loaded ? (
          <div style={{ color: '#888', fontSize: 14, textAlign: 'center', padding: 30 }}>불러오는 중…</div>
        ) : (
        <>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#aaa' }}>
          🙋 닉네임 <span style={{ color: '#666', fontSize: 12 }}>· 오락실·음악감상실·게시판 글쓰기에 쓰여요 (실명 아님, 최대 12자)</span>
          <input type="text" placeholder="예: 치킨러버" value={nickname} maxLength={12}
            onChange={e => setNickname(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#aaa' }}>
          🎂 생일
          <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
            style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#aaa' }}>
          🏠 주소
          <input type="text" placeholder="배달받을 주소 (예: 부평구 경원대로 1220)" value={address}
            onChange={e => setAddress(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#aaa' }}>
          ✉️ 이메일
          <input type="email" placeholder="example@email.com" value={email}
            onChange={e => setEmail(e.target.value)} style={inputStyle} />
        </label>

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#ccc',
          background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: '12px 14px',
          lineHeight: 1.6, cursor: 'pointer',
        }}>
          <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)}
            style={{ marginTop: 3, width: 16, height: 16, accentColor: '#c8a900' }} />
          <span>
            쿠폰, 이벤트, 재방문 혜택 안내 등 광고성 정보 수신에 동의합니다 <span style={{ color: '#666' }}>(선택)</span>
          </span>
        </label>

        {error && <p style={{ fontSize: 13, color: 'var(--red)' }}>{error}</p>}
        {saved && <p style={{ fontSize: 14, color: '#4caf50', fontWeight: 700 }}>✅ 저장됐어요!</p>}

        <button className="btn-primary" onClick={handleSave} disabled={loading || saved}>
          {loading ? '저장 중...' : '저장하기'}
        </button>
        <button className="skip-btn" onClick={() => router.back()}>
          다음에 할게요
        </button>
        </>
        )}
      </div>
      <LegalFooter />
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#111', border: '1px solid #444', borderRadius: 10,
  padding: '12px 14px', color: '#f0f0f0', fontSize: 15, outline: 'none',
}

const won = (n: number) => n.toLocaleString() + '원'
const fmtDate = (iso: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

type CouponCardProps = { c: { reason: string; emoji: string; discount_amount: number; min_order_amount: number; issued_at: string; expires_at: string; state: 'usable' | 'used' | 'expired' } }
function CouponCard({ c }: CouponCardProps) {
  const dim = c.state !== 'usable' // 사용됨·만료됨은 회색 처리(삭제 아님, 이력 보존)
  const badge = c.state === 'used'
    ? { text: '사용됨', color: '#888', bg: '#222' }
    : c.state === 'expired'
      ? { text: '만료됨', color: '#888', bg: '#222' }
      : { text: '사용가능', color: '#111', bg: '#c8a900' }
  return (
    <div style={{
      background: dim ? '#141414' : 'linear-gradient(135deg, rgba(200,169,0,0.14), rgba(200,169,0,0.04))',
      border: `1px solid ${dim ? '#2a2a2a' : '#7a6400'}`, borderRadius: 12, padding: '14px 16px',
      opacity: dim ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: dim ? '#888' : '#c9b060', fontWeight: 700, marginBottom: 2 }}>
            {c.emoji} {c.reason}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: dim ? '#aaa' : '#FFD700' }}>
            {won(c.discount_amount)} 할인
          </div>
          {c.min_order_amount > 0 && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{won(c.min_order_amount)} 이상 주문 시</div>
          )}
        </div>
        <span style={{ background: badge.bg, color: badge.color, fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
          {badge.text}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: '#777', marginTop: 8, borderTop: '1px dashed #333', paddingTop: 8 }}>
        {fmtDate(c.issued_at)} 발급 · <span style={{ color: c.state === 'expired' ? '#c86a6a' : '#999' }}>{fmtDate(c.expires_at)}까지</span>
      </div>
    </div>
  )
}
