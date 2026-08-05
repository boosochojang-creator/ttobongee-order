'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '../../../lib/cartStore'
import LegalFooter from '../../../lib/LegalFooter'
import {
  getDeferredPrompt, clearDeferredPrompt, isInstalled, isIOS,
  markInstalled, setMemberFlag,
} from '../../../lib/pwaInstall'
import { updateMemberLocal, getMemberLocal } from '../../../lib/memberState'
import { useStoreId } from '../../../lib/storeContext'
import { subscribeToPush } from '../../../lib/pushClient'

// 가입 완료 후 이어지는 설치 안내 단계 종류
type InstallStep = null | 'ios' | 'guide'

export default function LoginPage() {
  const router = useRouter()
  const storeId = useStoreId()
  const { setMember, isMember } = useCart()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // [고객상태 ③] 소셜 아이콘 클릭 — 이미 로그인(known)이면 OAuth 없이 바로 메뉴로, 아니면 인증 플로우.
  //   카카오·구글은 활성. 네이버는 상용전환 검수 완료 전까지 '준비중' 안내+음성만(버튼은 활성 유지).
  //   ※ 개발중 상태라 누르기 전엔 관리자/일반 구분 불가 → 탭하면 안내가 뜨고, 관리자는 안내 속 링크로 로그인.
  const [naverSoon, setNaverSoon] = useState(false)
  const speakSoon = () => {
    try {
      const u = new SpeechSynthesisUtterance('네이버 로그인은 준비중이에요. 곧 이용하실 수 있어요.')
      u.lang = 'ko-KR'; u.volume = 1; u.rate = 0.95
      window.speechSynthesis.speak(u)
    } catch {}
  }
  const handleSocial = (provider: 'kakao' | 'google' | 'naver') => {
    if (provider === 'naver') { setNaverSoon(true); speakSoon(); return } // 검수 전: 안내+음성
    if (isMember) { router.replace(`/store/${storeId}/menu`); return }
    window.location.href = `/api/auth/${provider}/start?storeId=${storeId}`
  }
  const [installStep, setInstallStep] = useState<InstallStep>(null)
  const [rejoinNotice, setRejoinNotice] = useState(false) // [항목1] 탈퇴 후 재가입(재활성화) 안내
  const [gateChecked, setGateChecked] = useState(false)

  // [항목7] 이미 가입된(영구 기록 보유) 회원이 로그인/가입 화면에 도달하면 회원가입 프롬프트가
  //   중복 노출되던 문제 → 영구 회원기록(MEMBER_KEY)이 있으면 곧장 메뉴로. (3시간 장바구니 상태가 아닌 영구값 기준)
  useEffect(() => {
    if (getMemberLocal()) { router.replace(`/store/${storeId}/menu`); return }
    setGateChecked(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const digits = phone.replace(/\D/g, '')

  const handleLogin = async () => {
    if (digits.length < 10) { setError('전화번호를 정확히 입력해주세요'); return }
    setLoading(true)
    try {
      // E2: 전화번호 해시 조회 + dual-write 가입을 서버 라우트로(HMAC/AES 키가 서버 비밀).
      const res = await fetch('/api/member/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits, storeId }),
      }).then(x => x.json()).catch(() => null)
      if (!res?.ok) { setError(res?.error || '로그인에 실패했어요. 잠시 후 다시 시도해주세요'); setLoading(false); return }
      const u = res.user

      // ── 가입 확정 (아래 설치 흐름과 무관하게 유지됨) ──
      setMember(u.id, digits, u.grade, u.visit_count, u.nickname)
      setMemberFlag(u.id, digits)
      if (u.member_status) updateMemberLocal({ status: u.member_status })
      // [2] 웹푸시 구독 — 로그인/가입과 함께 알림 권한 요청+구독(설치 유도 흐름에 자연스럽게). 거부/미지원은 조용히 스킵.
      subscribeToPush(u.id, storeId).catch(() => {})

      // [항목1] 탈퇴 후 재가입(재활성화) — 이력이 있어 신규 쿠폰 미지급. 안내 후 계속.
      if (res.rejoined) { setLoading(false); setRejoinNotice(true); return }

      // 가입 완료 → 같은 흐름에서 설치 승인 이어붙이기 (거부해도 가입은 그대로)
      if (isInstalled()) { router.replace(`/store/${storeId}/menu`); return }

      if (isIOS()) { setLoading(false); setInstallStep('ios'); return }

      const dp = getDeferredPrompt()
      if (dp) {
        try {
          dp.prompt() // 안드로이드: 브라우저 설치 승인창 (승인/거부는 고객 선택)
          const choice = await dp.userChoice
          if (choice?.outcome === 'accepted') markInstalled()
          clearDeferredPrompt()
        } catch {}
        router.replace(`/store/${storeId}/menu`)
        return
      }

      // 설치 이벤트를 지원하지 않는 브라우저 → 짧은 안내 후 복귀
      setLoading(false)
      setInstallStep('guide')
    } catch {
      setError('오류가 발생했어요. 다시 시도해주세요')
      setLoading(false)
    }
  }

  // ── [항목1] 탈퇴 후 재가입(재활성화) 안내 ──
  if (rejoinNotice) return (
    <main>
      <div className="login-page">
        <div className="brand">🍗 또봉이통닭</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--gold)', marginTop: 8 }}>
          다시 오신 걸 환영해요! 👋
        </div>
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--gold-dim)', borderRadius: 14,
          padding: '18px 16px', marginTop: 16, fontSize: 14, lineHeight: 1.9, color: '#e0e0e0',
        }}>
          이 번호로 <b style={{ color: '#FFD700' }}>가입하셨던 이력</b>이 있어요.<br />
          단골 혜택은 그대로 이어지지만, <b style={{ color: '#FFD700' }}>신규 가입 쿠폰은 다시 지급되지 않아요.</b><br />
          <span style={{ color: '#aaa', fontSize: 13 }}>양해 부탁드려요 🙏 오늘도 맛있게 준비할게요!</span>
        </div>
        <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => router.replace(`/store/${storeId}/menu`)}>
          확인, 주문 계속하기
        </button>
      </div>
      <LegalFooter />
    </main>
  )

  // ── 가입 완료 후 설치 안내 화면 (아이폰 / 미지원 브라우저) ──
  if (installStep) return (
    <main>
      <div className="login-page">
        <div className="brand">🍗 또봉이통닭</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--gold)', marginTop: 8 }}>
          🎉 단골 등록 완료!
        </div>
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--gold-dim)', borderRadius: 14,
          padding: '18px 16px', marginTop: 16, fontSize: 14, lineHeight: 1.9, color: '#e0e0e0',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>📲 이제 또봉이, 바탕화면에 담아두세요</div>
          {installStep === 'ios' ? (
            <>
              아이폰은 공유 버튼을 누른 뒤 &lsquo;홈 화면에 추가&rsquo;를 선택해 주세요.
              <ol style={{ margin: '10px 0 0 18px', color: '#ccc' }}>
                <li>Safari 하단 가운데 <span style={{ color: '#FFD700' }}>공유 버튼(⬆️)</span> 누르기</li>
                <li><span style={{ color: '#FFD700' }}>&lsquo;홈 화면에 추가&rsquo;</span> 선택</li>
                <li>오른쪽 위 <span style={{ color: '#FFD700' }}>추가</span> 누르면 완료!</li>
              </ol>
            </>
          ) : (
            <>브라우저 메뉴(⋮)에서 <span style={{ color: '#FFD700' }}>&lsquo;홈 화면에 추가&rsquo;</span> 또는 <span style={{ color: '#FFD700' }}>&lsquo;앱 설치&rsquo;</span>를 눌러주세요.</>
          )}
        </div>
        <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => router.replace(`/store/${storeId}/menu`)}>
          확인했어요, 주문 계속하기
        </button>
      </div>
      <LegalFooter />
    </main>
  )

  // [항목7] 회원 여부 확인 전에는 가입폼을 그리지 않음(이미 회원이면 깜빡임 없이 메뉴로 리다이렉트)
  if (!gateChecked) return <main><div className="login-page"><div className="brand">🍗 또봉이통닭</div></div></main>

  return (
    <main>
      <div className="login-page">
        <div className="brand">🍗 또봉이통닭</div>
        <div className="sub">백운역점</div>
        <div className="discount-badge">🎁 단골 등록하면 무료 쿠폰 (다음 방문 때 사용 가능)</div>
        <p style={{ fontSize: 14, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.6 }}>
3초 간편로그인으로 끝!<br />첫 방문도 자동으로 단골 등록됩니다
        </p>
        <div style={{
          fontSize: 13, color: '#c8a900', textAlign: 'center', lineHeight: 1.9,
          background: '#1a1200', border: '1px solid #7a6400', borderRadius: 12,
          padding: '12px 14px', width: '100%',
        }}>
          이제 또봉이, 바탕화면에 담아두세요.<br />
          가입 한 번이면 다음 주문은 눌러서 바로 —<br />
          포장도, 배달도, 이벤트 소식도 여기서 편하게 만나요.
        </div>
        {/* [고객상태 ③] 간편로그인 — 비활성 라벨 + 소셜 아이콘 3개(카카오만 활성, 구글·네이버 준비중) */}
        <div style={{ width: '100%', marginTop: 8 }}>
          <div style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 12, letterSpacing: 1 }}>간편로그인</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 22 }}>
            {/* 카카오 (활성) */}
            <button onClick={() => handleSocial('kakao')} aria-label="카카오로 로그인"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE500', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true"><path d="M20 8.5c-7 0-12.7 4.4-12.7 9.9 0 3.5 2.4 6.6 5.9 8.3-.2.8-1 3.4-1 3.7-.1.4.2.4.4.3.15-.1 3.8-2.6 4.6-3.1.9.12 1.8.2 2.8.2 7 0 12.7-4.4 12.7-9.9S27 8.5 20 8.5z" fill="#3C1E1E"/></svg>
              </span>
              <span style={{ fontSize: 12, color: '#ccc' }}>카카오</span>
            </button>
            {/* 구글 (활성) */}
            <button onClick={() => handleSocial('google')} aria-label="구글로 로그인"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ width: 56, height: 56, borderRadius: '50%', background: '#fff', border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: '#4285F4' }}>G</span>
              </span>
              <span style={{ fontSize: 12, color: '#ccc' }}>구글</span>
            </button>
            {/* 네이버 (활성 유지 — 탭 시 '준비중' 안내+음성. 관리자는 안내 속 링크로 로그인) */}
            <button onClick={() => handleSocial('naver')} aria-label="네이버로 로그인"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ width: 56, height: 56, borderRadius: '50%', background: '#03C75A', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>N</span>
              </span>
              <span style={{ fontSize: 12, color: '#ccc' }}>네이버</span>
            </button>
          </div>
          {naverSoon && (
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f0d890', textAlign: 'center', marginTop: 10, lineHeight: 1.7 }}>
              네이버 로그인은 준비중이에요, 곧 이용하실 수 있어요 🙏
              <br />
              <a href={`/api/auth/naver/start?storeId=${storeId}`}
                style={{ fontSize: 11.5, color: '#7a6a45', textDecoration: 'underline' }}>관리자 로그인</a>
            </div>
          )}
        </div>

        {/* 구분선 — 기존 전화가입 회원용(병행 운영, 점차 소셜로 전환) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', margin: '14px 0 4px' }}>
          <span style={{ flex: 1, height: 1, background: '#333' }} />
          <span style={{ fontSize: 12, color: '#777' }}>기존 전화번호 회원</span>
          <span style={{ flex: 1, height: 1, background: '#333' }} />
        </div>
        <div className="input-wrap" style={{ width: '100%' }}>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="010-0000-0000"
            value={phone}
            onChange={e => { setPhone(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>
        {error && <p style={{ fontSize: 13, color: 'var(--red)' }}>{error}</p>}
        <button className="btn-primary" onClick={handleLogin} disabled={loading}>
          {loading ? '확인 중...' : '전화번호로 로그인'}
        </button>
        {/* [항목2] 비회원 주문 비활성화 — 주문 없이 나가는 유일 선택지는 '잠깐 쉬었다 갈까요?'(허브) */}
        <button className="skip-btn" onClick={() => router.push(`/store/${storeId}/hub`)}>
          잠깐 쉬었다 갈까요?
        </button>
      </div>
      <LegalFooter />
    </main>
  )
}
