'use client'
// 추가정보 입력/수정 화면 (그룹 B-2) — 생일·주소·이메일 전부 선택 입력, 마케팅 동의는 별도.
// 동의 안 해도 저장·주문 가능. profile_complete 회원은 이 화면에서만 수정.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import LegalFooter from '../../../lib/LegalFooter'
import { getMemberLocal, updateMemberLocal, clearMemberLocal } from '../../../lib/memberState'
import { useStoreId } from '../../../lib/storeContext'

export default function ProfilePage() {
  const router = useRouter()
  const storeId = useStoreId()
  const [nickname, setNickname] = useState('')
  const [birthday, setBirthday] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [marketing, setMarketing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  // 회원 탈퇴
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')
  // [2] 내 쿠폰함 (메뉴 증정 방식)
  type Coupon = { id: string; reason: string; emoji: string; gift: string | null; discount_amount: number; min_order_amount: number; issued_at: string; usable_from: string | null; expires_at: string; state: 'usable' | 'upcoming' | 'used' | 'expired' }
  const [coupons, setCoupons] = useState<Coupon[] | null>(null)

  useEffect(() => {
    const m = getMemberLocal()
    if (!m) { router.replace(`/store/${storeId}/login`); return }
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

  const handleWithdraw = async () => {
    const m = getMemberLocal()
    if (!m) { router.replace(`/store/${storeId}/login`); return }
    setWithdrawing(true)
    setWithdrawError('')
    const res = await fetch('/api/member/withdraw', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: m.userId }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    if (!data?.ok) {
      setWithdrawing(false)
      setWithdrawError('탈퇴 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요')
      return
    }
    clearMemberLocal()
    // 하드 이동으로 인메모리 회원상태(장바구니 스토어)까지 초기화 → 게스트로 복원
    window.location.href = `/store/${storeId}/hub`
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
          {/* 사용 가능/곧 사용가능 쿠폰만 노출 (사용됨·만료됨은 이력 보존 위해 DB엔 남기고 화면에선 숨김) */}
          {(() => {
            const visible = coupons ? coupons.filter(c => c.state === 'usable' || c.state === 'upcoming') : null
            if (visible === null) return <div style={{ color: '#888', fontSize: 13, padding: '14px 0' }}>쿠폰을 불러오는 중…</div>
            if (visible.length === 0) return (
              <div style={{ color: '#888', fontSize: 13, background: '#141414', border: '1px solid #2a2a2a', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
                지금 사용할 수 있는 쿠폰이 없어요. 방문하시면 메뉴 증정 쿠폰을 드려요 💛
              </div>
            )
            return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{visible.map(c => <CouponCard key={c.id} c={c} />)}</div>
          })()}
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

        {/* 회원 탈퇴 */}
        <div style={{ borderTop: '1px solid #2a2a2a', marginTop: 8, paddingTop: 16, textAlign: 'center' }}>
          <button onClick={() => { setWithdrawError(''); setShowWithdraw(true) }}
            style={{ background: 'none', border: 'none', color: '#777', fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}>
            회원 탈퇴
          </button>
        </div>
      </div>

      {/* 탈퇴 확인 모달 */}
      {showWithdraw && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => { if (!withdrawing) setShowWithdraw(false) }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#181818', border: '1px solid #3a3a3a', borderRadius: 16,
            padding: '22px 20px', maxWidth: 360, width: '100%', display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#f0f0f0' }}>정말 탈퇴하시겠어요?</div>
            <div style={{ fontSize: 13.5, color: '#bbb', lineHeight: 1.75 }}>
              탈퇴하면 아래 내용이 처리되며 <span style={{ color: '#e88', fontWeight: 700 }}>되돌릴 수 없어요.</span>
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#aaa', lineHeight: 1.9 }}>
                <li>전화번호 등 <b>개인정보가 삭제</b>돼요</li>
                <li>보유하신 <b>쿠폰이 모두 사라져요</b></li>
                <li>지난 주문 내역은 매장 정산·통계 목적으로 <b>이름 없이(비식별)</b> 남아요</li>
              </ul>
              <div style={{ marginTop: 10, color: '#888' }}>같은 번호로 언제든 다시 가입하실 수 있어요 (신규 가입 혜택도 다시 드려요 💛)</div>
            </div>
            {withdrawError && <div style={{ fontSize: 13, color: 'var(--red)' }}>{withdrawError}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setShowWithdraw(false)} disabled={withdrawing} style={{
                flex: 1, padding: '13px', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer',
                background: '#2a2a2a', color: '#eee', border: '1px solid #444',
              }}>취소</button>
              <button onClick={handleWithdraw} disabled={withdrawing} style={{
                flex: 1, padding: '13px', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer',
                background: withdrawing ? '#5a2a2a' : '#c0392b', color: '#fff', border: 'none',
              }}>{withdrawing ? '처리 중...' : '탈퇴하기'}</button>
            </div>
          </div>
        </div>
      )}

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

type CouponCardProps = { c: { reason: string; emoji: string; gift: string | null; discount_amount: number; min_order_amount: number; issued_at: string; usable_from: string | null; expires_at: string; state: 'usable' | 'upcoming' | 'used' | 'expired' } }
function CouponCard({ c }: CouponCardProps) {
  const dim = c.state === 'used' || c.state === 'expired' // 사용됨·만료됨만 회색(여긴 안 보이지만 안전용)
  const badge = c.state === 'used'
    ? { text: '사용됨', color: '#888', bg: '#222' }
    : c.state === 'expired'
      ? { text: '만료됨', color: '#888', bg: '#222' }
      : c.state === 'upcoming'
        ? { text: '곧 사용가능', color: '#111', bg: '#8ab8e0' }
        : { text: '사용가능', color: '#111', bg: '#3ac47d' }
  // 증정 메뉴 문구(신방식). 구 쿠폰(gift 없음)은 금액할인으로 폴백.
  const title = c.gift ? `${c.gift} 무료 증정` : `${won(c.discount_amount)} 할인`
  // 무제한(신규가입) 여부: 만료가 아주 먼 미래면 '무제한'으로 표기
  const farFuture = c.expires_at && (new Date(c.expires_at).getTime() - Date.now()) > 3650 * 86400000
  return (
    <div style={{
      background: dim ? '#141414' : 'linear-gradient(135deg, rgba(58,196,125,0.14), rgba(200,169,0,0.05))',
      border: `1px solid ${dim ? '#2a2a2a' : '#3a6a4a'}`, borderRadius: 12, padding: '14px 16px',
      opacity: dim ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: dim ? '#888' : '#8ecfa5', fontWeight: 700, marginBottom: 2 }}>
            {c.emoji} {c.reason}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: dim ? '#aaa' : '#fff' }}>
            🎁 {title}
          </div>
          {c.min_order_amount > 0 && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{won(c.min_order_amount)} 이상 주문 시</div>
          )}
          {c.state === 'upcoming' && c.usable_from && (
            <div style={{ fontSize: 12, color: '#8ab8e0', fontWeight: 700, marginTop: 3 }}>📅 {fmtDate(c.usable_from)}부터 사용 가능</div>
          )}
        </div>
        <span style={{ background: badge.bg, color: badge.color, fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
          {badge.text}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: '#777', marginTop: 8, borderTop: '1px dashed #333', paddingTop: 8 }}>
        {fmtDate(c.issued_at)} 발급 · <span style={{ color: c.state === 'expired' ? '#c86a6a' : '#999' }}>{farFuture ? '기간 제한 없음' : `${fmtDate(c.expires_at)}까지`}</span>
      </div>
    </div>
  )
}
