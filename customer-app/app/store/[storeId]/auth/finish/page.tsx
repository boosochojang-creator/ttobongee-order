'use client'
// 소셜 로그인 마무리 — 콜백이 넘긴 서명토큰으로 분기.
//   token(session): 기존 소셜회원 → 바로 로그인 처리.
//   pending: 신규 소셜신원 → "기존 전화 단골 연결 / 새로 시작" 선택.
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '../../../../lib/cartStore'
import { useStoreId } from '../../../../lib/storeContext'
import { setMemberFlag } from '../../../../lib/pwaInstall'
import { updateMemberLocal } from '../../../../lib/memberState'
import { subscribeToPush } from '../../../../lib/pushClient'
import { getDeviceId } from '../../../../lib/deviceId'
import LegalFooter from '../../../../lib/LegalFooter'

// 소셜 3사 공용 — provider별 표시명. 콜백이 붙여주는 ?provider= 로 분기.
const PROVIDER_LABEL: Record<string, string> = { kakao: '카카오', google: '구글', naver: '네이버' }
const errMsg = (err: string, label: string): string => ({
  config: `${label} 로그인 설정이 아직 준비되지 않았어요.`,
  state: '보안 확인에 실패했어요. 다시 시도해주세요.',
  token: `${label} 인증에 실패했어요. 다시 시도해주세요.`,
  profile: `${label} 프로필을 가져오지 못했어요.`,
  denied: `${label} 로그인을 취소하셨어요.`,
  server: '오류가 발생했어요. 다시 시도해주세요.',
}[err] || '오류가 발생했어요. 다시 시도해주세요.')

function Finish() {
  const router = useRouter()
  const storeId = useStoreId()
  const { setMember } = useCart()
  const params = useSearchParams()
  const [mode, setMode] = useState<'loading' | 'choose' | 'linkInput' | 'error'>('loading')
  const [error, setError] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const nickname = params.get('nickname') || ''
  const pending = params.get('pending') || ''
  const provider = params.get('provider') || 'kakao'
  const providerLabel = PROVIDER_LABEL[provider] || '소셜'
  const connect = params.get('connect') === '1' // 기존 전화회원의 계정연결 진입(전화연결부터, '새로시작' 미노출)
  const ran = useRef(false)

  // 로그인 확정 → MEMBER_KEY 저장(기존 login 페이지와 동일 처리) 후 메뉴 복귀
  const finalize = (u: any) => {
    setMember(u.id, '', u.grade, u.visit_count, u.nickname) // 전화 미수집 → phone=''
    setMemberFlag(u.id, '')
    if (u.member_status) updateMemberLocal({ status: u.member_status })
    subscribeToPush(u.id, storeId).catch(() => {})
    router.replace(`/store/${storeId}/menu`)
  }

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const err = params.get('err')
    if (err) { setError(errMsg(err, providerLabel)); setMode('error'); return }
    const token = params.get('token')
    if (token) {
      fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
        .then(r => r.json()).then(r => {
          if (r?.ok) finalize(r.user)
          else { setError(r?.error || errMsg('server', providerLabel)); setMode('error') }
        }).catch(() => { setError(errMsg('server', providerLabel)); setMode('error') })
      return
    }
    // connect(기존 전화회원 계정연결)이면 '새로시작' 트랩 없이 전화연결 입력부터. 일반 신규는 선택화면.
    if (pending) { setMode(connect ? 'linkInput' : 'choose'); return }
    setError(errMsg('state', providerLabel)); setMode('error')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doSocialNew = async () => {
    setBusy(true); setError('')
    const r = await fetch('/api/member/social-new', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pending, storeId, deviceId: getDeviceId() }),
    }).then(x => x.json()).catch(() => null)
    if (r?.ok) finalize(r.user)
    else { setError(r?.error || errMsg('server', providerLabel)); setBusy(false) }
  }

  const doLink = async () => {
    if (phone.replace(/\D/g, '').length < 10) { setError('전화번호를 정확히 입력해주세요'); return }
    setBusy(true); setError('')
    const r = await fetch('/api/member/link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pending, phone, storeId, deviceId: getDeviceId() }),
    }).then(x => x.json()).catch(() => null)
    if (r?.ok) finalize(r.user)
    else if (r?.code === 'no_match') { setError(r.error); setBusy(false) } // 새로 시작 유도
    else { setError(r?.error || errMsg('server', providerLabel)); setBusy(false) }
  }

  return (
    <main>
      <div className="login-page">
        <div className="brand">🍗 또봉이통닭</div>

        {mode === 'loading' && (
          <div style={{ marginTop: 24, color: '#aaa', fontSize: 14 }}>로그인 처리 중…</div>
        )}

        {mode === 'error' && (
          <>
            <div style={{ fontSize: 15, color: '#e84040', marginTop: 16, lineHeight: 1.7, textAlign: 'center' }}>{error}</div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => { window.location.href = `/api/auth/${provider}/start?storeId=${storeId}` }}>
              {providerLabel}로 다시 시도
            </button>
            <button className="skip-btn" onClick={() => router.replace(`/store/${storeId}/menu`)}>메뉴로 돌아가기</button>
          </>
        )}

        {mode === 'choose' && (
          <>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--gold)', marginTop: 8 }}>
              {nickname ? `${nickname}님, 환영해요!` : '환영해요!'}
            </div>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--gold-dim)', borderRadius: 14, padding: '18px 16px', marginTop: 16, fontSize: 14, lineHeight: 1.8, color: '#e0e0e0' }}>
              혹시 <b style={{ color: '#FFD700' }}>예전에 전화번호로 단골 등록</b>하신 적 있으세요?<br />
              전화번호로 연결하면 <b style={{ color: '#FFD700' }}>기존 단골 혜택·쿠폰이 그대로</b> 이어져요.
            </div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => { setError(''); setMode('linkInput') }}>
              네, 전화번호로 연결할게요
            </button>
            <button className="skip-btn" onClick={doSocialNew} disabled={busy}>
              {busy ? '처리 중…' : '처음이에요 · 새로 시작'}
            </button>
            {error && <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 10 }}>{error}</div>}
          </>
        )}

        {mode === 'linkInput' && (
          <>
            {connect && (
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)', marginTop: 8 }}>
                {providerLabel} 계정 연결하기
              </div>
            )}
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', marginTop: 12 }}>기존에 쓰시던 전화번호를 입력해주세요</div>
            <div style={{ fontSize: 12.5, color: '#999', marginTop: 4, lineHeight: 1.6 }}>확인되면 {providerLabel} 계정에 연결하고, 전화번호는 <b>자동으로 삭제</b>돼요.</div>
            <div className="input-wrap" style={{ width: '100%', marginTop: 12 }}>
              <input type="tel" inputMode="numeric" placeholder="010-0000-0000" value={phone}
                onChange={e => { setPhone(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && doLink()} />
            </div>
            {error && <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 8 }}>{error}</div>}
            <button className="btn-primary" style={{ marginTop: 14 }} onClick={doLink} disabled={busy}>
              {busy ? '연결 중…' : '연결하기'}
            </button>
            {/* connect(계정연결) 진입이면 '새로 시작'은 숨김 — 실수로 새 계정 만들어 기존 쿠폰/등급을 잃는 것 방지 */}
            {connect
              ? <button className="skip-btn" onClick={() => router.replace(`/store/${storeId}/menu`)} disabled={busy}>나중에 할게요</button>
              : <button className="skip-btn" onClick={doSocialNew} disabled={busy}>연결 없이 새로 시작</button>}
          </>
        )}
      </div>
      <LegalFooter />
    </main>
  )
}

export default function AuthFinishPage() {
  return <Suspense fallback={<main><div className="login-page"><div className="brand">🍗 또봉이통닭</div></div></main>}><Finish /></Suspense>
}
