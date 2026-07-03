'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '../../../lib/cartStore'
import { supabase } from '../../../lib/supabase'
import LegalFooter from '../../../lib/LegalFooter'
import {
  getDeferredPrompt, clearDeferredPrompt, isInstalled, isIOS,
  markInstalled, setMemberFlag,
} from '../../../lib/pwaInstall'

// 가입 완료 후 이어지는 설치 안내 단계 종류
type InstallStep = null | 'ios' | 'guide'

export default function LoginPage() {
  const router = useRouter()
  const { setMember } = useCart()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [installStep, setInstallStep] = useState<InstallStep>(null)

  const digits = phone.replace(/\D/g, '')

  const handleLogin = async () => {
    if (digits.length < 10) { setError('전화번호를 정확히 입력해주세요'); return }
    setLoading(true)
    try {
      // upsert 회원
      const { data: existing } = await supabase
        .from('users').select('id, grade, visit_count').eq('store_id', 'baegun').eq('phone', digits).single()

      let uid: string
      let memberGrade = 'bronze'
      let memberVisitCount = 0
      if (existing) {
        uid = existing.id
        memberGrade = existing.grade ?? 'bronze'
        memberVisitCount = existing.visit_count ?? 0
        await supabase.from('users').update({
          last_visit: new Date().toISOString()
        }).eq('id', uid)
      } else {
        const { data: newUser, error: err } = await supabase.from('users').insert({
          store_id: 'baegun', phone: digits
        }).select('id, grade, visit_count').single()
        if (err || !newUser) throw err
        uid = newUser.id
        memberGrade = newUser.grade ?? 'bronze'
        memberVisitCount = newUser.visit_count ?? 0
      }

      // ── 가입은 여기서 이미 확정 (아래 설치 흐름과 무관하게 유지됨) ──
      setMember(uid, digits, memberGrade, memberVisitCount)
      setMemberFlag(uid, digits)

      // 가입 완료 → 같은 흐름에서 설치 승인 이어붙이기 (거부해도 가입은 그대로)
      if (isInstalled()) { router.back(); return }

      if (isIOS()) { setLoading(false); setInstallStep('ios'); return }

      const dp = getDeferredPrompt()
      if (dp) {
        try {
          dp.prompt() // 안드로이드: 브라우저 설치 승인창 (승인/거부는 고객 선택)
          const choice = await dp.userChoice
          if (choice?.outcome === 'accepted') markInstalled()
          clearDeferredPrompt()
        } catch {}
        router.back()
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

  // ── 가입 완료 후 설치 안내 화면 (아이폰 / 미지원 브라우저) ──
  if (installStep) return (
    <main>
      <div className="login-page">
        <div className="brand">🍗 또봉이통닭</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--gold)', marginTop: 8 }}>
          🎉 단골 등록 완료!
        </div>
        <div style={{
          background: '#1c1c1c', border: '1px solid #c8a900', borderRadius: 14,
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
        <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => router.back()}>
          확인했어요, 주문 계속하기
        </button>
      </div>
      <LegalFooter />
    </main>
  )

  return (
    <main>
      <div className="login-page">
        <div className="brand">🍗 또봉이통닭</div>
        <div className="sub">백운역점</div>
        <div className="discount-badge">🎁 단골 등록 시 5% 할인</div>
        <p style={{ fontSize: 14, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.6 }}>
          전화번호만 입력하면 끝!<br />첫 방문도 자동으로 단골 등록됩니다
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
          {loading ? '확인 중...' : '5% 할인받고 주문하기'}
        </button>
        <button className="skip-btn" onClick={() => router.back()}>
          할인 없이 그냥 주문할게요
        </button>
      </div>
      <LegalFooter />
    </main>
  )
}
