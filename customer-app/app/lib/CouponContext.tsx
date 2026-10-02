'use client'
// 쿠폰 표시 공용 상태(레이아웃 상주). 세 기능이 이 한 소스를 공유한다.
//   A. 새 쿠폰 발급 시 안내+음성 팝업 → 음성 끝나면 자동 소멸(화면 크게 안 가리는 토스트형)
//   B. 상시 보유 쿠폰 개수 뱃지(좌하단 FAB) → 탭하면 목록 시트
//   D. 주문 화면(menu/cart/checkout) 진입 시 "쓸 수 있는 쿠폰 N개" 배너(useCoupons로 페이지가 사용)
// ★그룹1 핫픽스 교훈: 음성 전처리에서 예외가 나도 speak를 막지 않게 방어(try/catch 분리, 위험한 정규식 미사용).
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from './cartStore'
import { useStoreId } from './storeContext'

export type Coupon = {
  id: string
  reason: string
  emoji: string
  gift: string | null
  min_order_amount: number
  usable_from: string | null
  expires_at: string | null
  state: 'usable' | 'upcoming' | 'used' | 'expired'
}

type Ctx = { usable: Coupon[]; upcoming: Coupon[]; count: number; refresh: () => void }
const CouponContext = createContext<Ctx>({ usable: [], upcoming: [], count: 0, refresh: () => {} })

const SEEN_KEY = 'ttobongee-seen-coupons'
const readSeen = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) } catch { return new Set() }
}
const writeSeen = (s: Set<string>) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(s))) } catch {} }

// 방어적 음성 — 전처리/미지원에서 예외가 나도 삼키고, speak만 개별 try. (그룹1 핫픽스 교훈)
function speakSafe(text: string) {
  const once = () => {
    try {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'ko-KR'; u.volume = 1; u.rate = 0.95
      u.onend = () => { try { window.dispatchEvent(new Event('coupon-voice-end')) } catch {} }
      window.speechSynthesis.speak(u)
    } catch { try { window.dispatchEvent(new Event('coupon-voice-end')) } catch {} }
  }
  once()
}

export function CouponProvider({ children }: { children: ReactNode }) {
  const { userId, hydrated, isMember, tableNo, orderType } = useCart()
  const pathname = usePathname()
  const router = useRouter()
  const storeId = useStoreId()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [popup, setPopup] = useState<Coupon[] | null>(null) // A: 새로 발급된(안 본) 쿠폰 팝업
  const popupTimer = useRef<any>(null)
  const [visitPopup, setVisitPopup] = useState<number | null>(null) // [2026-10] 5번째 방문 쿠폰 안내(방문 번호)
  const visitTried = useRef(0)

  const usable = coupons.filter(c => c.state === 'usable')
  const upcoming = coupons.filter(c => c.state === 'upcoming')

  const refresh = useCallback(() => {
    if (!userId) { setCoupons([]); return }
    fetch(`/api/coupons/list?userId=${userId}`).then(r => r.json())
      .then(r => setCoupons(r?.ok ? (r.coupons as Coupon[]) : []))
      .catch(() => {})
  }, [userId])

  // 회원 확정되면 로드 + 앱 복귀(focus) 시 갱신(발급/사용 반영)
  useEffect(() => { if (hydrated) refresh() }, [hydrated, refresh])
  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  // A: 아직 안 본 사용가능/예정 쿠폰이 생기면 팝업+음성 (한 번 보여준 건 seen에 기록)
  useEffect(() => {
    const fresh = coupons.filter(c => (c.state === 'usable' || c.state === 'upcoming'))
    if (!fresh.length) return
    const seen = readSeen()
    const unseen = fresh.filter(c => !seen.has(c.id))
    if (!unseen.length) return
    setPopup(unseen)
    const spoken = unseen.length === 1
      ? `${unseen[0].reason} 쿠폰이 발급되었어요. ${unseen[0].gift || ''}`
      : `새 쿠폰 ${unseen.length}장이 발급되었어요`
    speakSafe(spoken)
    const s = readSeen(); unseen.forEach(c => s.add(c.id)); writeSeen(s)
    // 음성 끝나면 소멸 + 안전 타임아웃(음성 미지원 대비)
    const close = () => { setPopup(null) }
    window.addEventListener('coupon-voice-end', close, { once: true })
    clearTimeout(popupTimer.current)
    popupTimer.current = setTimeout(close, 6000)
    return () => { window.removeEventListener('coupon-voice-end', close); clearTimeout(popupTimer.current) }
  }, [coupons])

  const onStore = !!pathname && pathname.startsWith('/store/')

  // [2026-10] 5번째 방문 감사 쿠폰 — 매장에 착석(QR/자리선택·포장 선택)한 회원이 주문 화면에 들어오면 서버에 판정 요청.
  //   5·10·15…번째 방문이면 즉시 발급(당일 사용) → 큰 안내창 + 음성. 서버가 중복을 막으므로 2분 간격으로만 재확인.
  useEffect(() => {
    if (!hydrated || !userId || !isMember || !onStore || !storeId) return
    const seated = parseInt(String(tableNo || '0'), 10) > 0 || orderType === 'takeout'
    if (!seated) return
    if (Date.now() - visitTried.current < 120000) return
    visitTried.current = Date.now()
    fetch('/api/coupons/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, storeId }) })
      .then(r => r.json())
      .then(r => {
        if (!r?.ok || !r.issued) return
        const s = readSeen(); s.add(r.couponId); writeSeen(s) // 일반 발급 토스트와 중복 안내 방지
        setVisitPopup(r.visitNo)
        speakSafe(`오늘 ${r.visitNo}번째 방문이에요! 감사의 마음으로 소주 한 병 또는 생맥주 오백 한 잔을 무료로 드려요. 오늘 주문하실 때 자동으로 함께 들어가요.`)
        refresh()
      })
      .catch(() => {})
  }, [hydrated, userId, isMember, onStore, storeId, tableNo, orderType, pathname, refresh])
  // 뱃지는 '보유' 기준(usable + upcoming) — 다음날부터 쓰는 신규가입 쿠폰도 즉시 보이게(가입 직후 뱃지 미표시 수정).
  const heldCount = usable.length + upcoming.length
  const showBadge = onStore && heldCount > 0

  return (
    <CouponContext.Provider value={{ usable, upcoming, count: usable.length, refresh }}>
      {children}

      {/* A. 발급 안내 팝업 (상단 토스트형, 자동 소멸) */}
      {popup && popup.length > 0 && (
        <div style={{
          position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)', zIndex: 320,
          width: 'min(92vw, 400px)', background: 'linear-gradient(135deg, #1f1a00, #2a2200)',
          border: '2px solid #FFD700', borderRadius: 16, padding: '14px 18px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)', animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#FFD700', marginBottom: 4 }}>🎁 쿠폰이 도착했어요!</div>
          {popup.slice(0, 3).map(c => (
            <div key={c.id} style={{ fontSize: 13, color: '#f0e6c0', lineHeight: 1.6 }}>
              {c.emoji} <b>{c.reason}</b>{c.gift ? ` · ${c.gift}` : ''}
            </div>
          ))}
          {popup.length > 3 && <div style={{ fontSize: 12, color: '#c8b060' }}>외 {popup.length - 3}장</div>}
        </div>
      )}

      {/* [2026-10] 5번째 방문 감사 쿠폰 안내 — 확인을 누를 때까지 유지 */}
      {visitPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 330, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: 'min(92vw, 380px)', background: 'linear-gradient(160deg, #2a2000, #1a1400)', border: '2px solid #FFD700', borderRadius: 20, padding: '26px 22px', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.7)' }}>
            <div style={{ fontSize: 46, marginBottom: 6 }}>🍺</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#FFD700', marginBottom: 8 }}>오늘 {visitPopup}번째 방문이에요!</div>
            <div style={{ fontSize: 15, color: '#f5ecc8', lineHeight: 1.7, marginBottom: 6 }}>
              감사의 마음으로<br /><b style={{ color: '#fff' }}>소주 1병 또는 생맥주 500cc 1잔</b><br />무료로 드려요
            </div>
            <div style={{ fontSize: 12.5, color: '#c8b070', lineHeight: 1.6, marginBottom: 18 }}>
              오늘 주문하실 때 자동으로 함께 들어가요<br />(오늘 영업 마감까지 사용 가능)
            </div>
            <button onClick={() => setVisitPopup(null)} style={{ width: '100%', padding: 14, background: 'linear-gradient(150deg,#d6b25a,#bd9a3c 45%,#7a5715)', color: '#111', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 900, cursor: 'pointer' }}>
              확인
            </button>
          </div>
        </div>
      )}

      {/* B. 상시 쿠폰 뱃지 (좌하단 — 우측 종 FAB와 반대편) */}
      {showBadge && (
        <button
          onClick={() => setSheetOpen(true)}
          aria-label="내 쿠폰"
          style={{
            position: 'fixed', bottom: 90, left: 16, zIndex: 201,
            width: 56, height: 56, borderRadius: '50%',
            background: '#1c1c1c', border: '1.5px solid #c8a900',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          🎟️
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, padding: '0 5px',
            background: '#e84040', color: '#fff', fontSize: 12, fontWeight: 800,
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{heldCount}</span>
        </button>
      )}

      {/* B. 쿠폰 목록 시트 */}
      {sheetOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 320, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setSheetOpen(false)}
        >
          <div
            style={{ background: '#1c1c1c', borderRadius: '20px 20px 0 0', padding: '22px 18px 40px', width: '100%', maxWidth: 480, maxHeight: '75vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 4 }}>🎟️ 내 쿠폰</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>결제는 카운터에서, 쿠폰 증정은 주문 시 자동 안내돼요.</div>
            {[...usable, ...upcoming].length === 0 ? (
              <div style={{ color: '#888', fontSize: 13, padding: '12px 0' }}>지금 사용할 수 있는 쿠폰이 없어요.</div>
            ) : [...usable, ...upcoming].map(c => (
              <div key={c.id} style={{
                background: c.state === 'usable' ? 'linear-gradient(135deg, rgba(58,196,125,0.14), rgba(200,169,0,0.08))' : '#242424',
                border: `1px solid ${c.state === 'usable' ? '#3ac47d' : '#444'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8,
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#f0f0f0' }}>{c.emoji} {c.reason}</div>
                {c.gift && <div style={{ fontSize: 13, color: '#cfe6d5', marginTop: 2 }}>🎁 {c.gift}</div>}
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                  {c.state === 'upcoming'
                    ? `${c.usable_from ? new Date(c.usable_from).toLocaleDateString('ko-KR') : ''}부터 사용 가능`
                    : c.min_order_amount ? `${c.min_order_amount.toLocaleString()}원 이상 주문 시` : '바로 사용 가능'}
                  {c.expires_at && new Date(c.expires_at).getFullYear() < 2100 ? ` · ${new Date(c.expires_at).toLocaleDateString('ko-KR')}까지` : ''}
                </div>
              </div>
            ))}
            <button onClick={() => { setSheetOpen(false); router.push(`/store/${storeId}/profile`) }}
              style={{ width: '100%', marginTop: 6, padding: '10px', background: 'none', color: '#888', fontSize: 13, border: '1px solid #333', borderRadius: 10, cursor: 'pointer' }}>
              내 정보에서 전체 보기
            </button>
          </div>
        </div>
      )}
    </CouponContext.Provider>
  )
}

export function useCoupons() {
  return useContext(CouponContext)
}
