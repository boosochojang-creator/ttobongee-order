'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '../../../lib/cartStore'
import { supabase } from '../../../lib/supabase'
import LegalFooter from '../../../lib/LegalFooter'

export default function LoginPage() {
  const router = useRouter()
  const { setMember } = useCart()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      setMember(uid, digits, memberGrade, memberVisitCount)
      router.back()
    } catch {
      setError('오류가 발생했어요. 다시 시도해주세요')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <div className="login-page">
        <div className="brand">🍗 또봉이통닭</div>
        <div className="sub">백운역점</div>
        <div className="discount-badge">🎁 단골 등록 시 5% 할인</div>
        <p style={{ fontSize: 14, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.6 }}>
          전화번호만 입력하면 끝!<br />첫 방문도 자동으로 단골 등록됩니다
        </p>
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
