'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '../../../lib/cartStore'
import { supabase } from '../../../lib/supabase'
import LegalFooter from '../../../lib/LegalFooter'
import ProfilePrompt from '../../../lib/ProfilePrompt'
import { getMemberLocal } from '../../../lib/memberState'

type MenuItem = { id: number; category: string; name: string; price: number; is_available: boolean; image_url?: string | null }

const CATS = ['세트메뉴', '치킨류', '안주류', '음료/주류']
const CAT_ICONS: Record<string, string> = {
  '세트메뉴': '🔥',
  '치킨류': '🍗',
  '안주류': '🥘',
  '음료/주류': '🍺',
}
// v1.4: 화면 표시용 카테고리명/아이콘 — DB category 값('음료/주류')은 그대로 두고 화면 표기만 "음료"로 변경
const CAT_DISPLAY: Record<string, { label: string; icon: string }> = {
  '음료/주류': { label: '음료', icon: '🥤' },
}
// v1.4: 이미지 없이 빈 썸네일로 표시할 상품명
const NO_IMAGE_NAMES = ['음료(소)', '음료(대)']
const FORTUNES = [
  '오늘 치킨 먹으면 좋은 일 생겨요 🍗',
  '생맥주 한 잔의 여유, 오늘 수고했어요 🍺',
  '또봉이 치킨은 당신의 하루를 응원합니다 💛',
  '지금이 바로 치킨 먹을 최고의 타이밍!',
]

const GRADE_LABEL: Record<string, string> = { gold: '🥇 골드 단골', silver: '🥈 실버 단골', bronze: '🥉 브론즈 단골' }
const GRADE_COLOR: Record<string, string> = { gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32' }

export default function MenuPage() {
  const router = useRouter()
  const { addItem, updateQty, items, totalQty, finalAmount, tableNo, orderType, isMember, phone, grade, visitCount } = useCart()
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [activeCat, setActiveCat] = useState('세트메뉴')
  const [showCall, setShowCall] = useState(false)
  const [showLoginBanner, setShowLoginBanner] = useState(!isMember)
  // phone_member 이상(영구 가입 기록 보유)에게는 회원가입 문구를 절대 다시 안 띄움
  // (isMember는 3시간짜리 장바구니 상태라, 시간이 지난 회원에게 가입 배너가 재노출되던 허점 보완)
  const [isJoined, setIsJoined] = useState(false)
  useEffect(() => { setIsJoined(!!getMemberLocal()) }, [])

  // Phase 3 방식 B: 이 테이블에 진행 중인 더치페이가 있으면 참여 배너 노출
  const [splitSession, setSplitSession] = useState<{ id: string; paid_count: number; participant_count: number } | null>(null)
  useEffect(() => {
    if (!tableNo || tableNo === '0') return
    fetch(`/api/split?table=${tableNo}`).then(x => x.json())
      .then(r => { if (r?.ok && r.session) setSplitSession(r.session) })
      .catch(() => {})
  }, [tableNo])
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerH, setHeaderH] = useState(114)

  useEffect(() => {
    supabase.from('menus').select('*').eq('store_id', 'baegun').order('sort_order')
      .then(({ data }) => { if (data) setMenus(data) })
  }, [])

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const update = () => setHeaderH(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => { ro.disconnect(); window.removeEventListener('resize', update) }
  }, [])

  const scrollToCat = (cat: string) => {
    setActiveCat(cat)
    catRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const getQty = (id: number) => items.find(i => i.id === id)?.qty || 0

  const handleQty = (item: MenuItem, delta: number) => {
    const cur = getQty(item.id)
    if (delta > 0) {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.connect(g); g.connect(ctx.destination)
        osc.frequency.value = 880
        g.gain.setValueAtTime(0.06, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07)
        osc.start(); osc.stop(ctx.currentTime + 0.09)
      } catch {}
    }
    if (cur === 0 && delta > 0) addItem({ id: item.id, name: item.name, price: item.price })
    else updateQty(item.id, cur + delta)
  }

  const label = orderType === 'takeout' ? '포장' : `${tableNo}번 테이블`

  return (
    <main>
      {/* 상단 고정 헤더 (헤더 + 조리 안내 + 카테고리 탭) */}
      <div className="sticky-header" ref={headerRef}>
        <div className="top-bar" style={{ position: 'static' }}>
          <span className="logo">🍗 또봉이</span>
          <span className="table-badge">{label}</span>
        </div>

        {/* 조리 중 안내 배너 */}
        <div className="cook-notice">
          갓 튀긴 맛을 위해 조리 중입니다 🍗 대기 상황에 따라 10~30분 소요될 수 있어요. 조금만 기다려 주시면 맛으로 보답할게요!
        </div>

        {/* 카테고리 탭 */}
        <div className="cat-tabs" style={{ position: 'static' }}>
          {CATS.map(c => (
            <button key={c} className={activeCat === c ? 'active' : ''} onClick={() => scrollToCat(c)}>
              {CAT_DISPLAY[c]?.icon ?? CAT_ICONS[c]} {CAT_DISPLAY[c]?.label ?? c}
            </button>
          ))}
        </div>
      </div>

      {/* 회원 배너 */}
      {isMember ? (
        <div style={{
          background: 'linear-gradient(135deg, rgba(200,169,0,0.15), rgba(200,169,0,0.05))',
          border: `1px solid ${GRADE_COLOR[grade] ?? '#7a6400'}44`,
          borderRadius: 12, padding: '16px 18px', margin: '12px 16px 0',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ fontSize: 36 }}>😊</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#f0f0f0' }}>
              {phone.slice(-4)}님, 다시 오셨군요!
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                background: `${GRADE_COLOR[grade] ?? '#CD7F32'}22`,
                color: GRADE_COLOR[grade] ?? '#CD7F32',
                border: `1px solid ${GRADE_COLOR[grade] ?? '#CD7F32'}66`,
                borderRadius: 20, padding: '2px 10px', fontSize: 13, fontWeight: 700,
              }}>
                {GRADE_LABEL[grade] ?? '🥉 브론즈 단골'}
              </span>
              <span style={{ fontSize: 13, color: '#888' }}>· {visitCount}번째 방문</span>
              <button
                onClick={() => router.push('/store/baegun/profile')}
                style={{
                  marginLeft: 'auto', background: 'none', border: '1px solid #444',
                  borderRadius: 20, padding: '2px 10px', fontSize: 12, color: '#aaa', cursor: 'pointer',
                }}
              >
                내 정보 ›
              </button>
            </div>
          </div>
        </div>
      ) : (!isJoined && showLoginBanner) && (
        <div style={{
          background:'linear-gradient(135deg, rgba(200,169,0,0.18), rgba(200,169,0,0.06))',
          border:'1px solid #7a6400', borderRadius:12,
          padding:'20px 16px', margin:'12px 16px 0',
          display:'flex', flexDirection:'column', gap:8
        }}>
          <div style={{fontSize:20, fontWeight:900, color:'#c8a900'}}>
            🎁 단골 등록하고 5% 할인받기
          </div>
          <div style={{fontSize:15, color:'#ccc', lineHeight:1.7}}>
            전화번호 3초 입력으로 끝!<br/>
            오늘 주문부터 <span style={{color:'#FF6B00', fontWeight:700}}>바로 적용</span>됩니다
          </div>
          <div style={{display:'flex', gap:8, marginTop:4}}>
            <button
              style={{flex:1, padding:'12px', background:'#c8a900', color:'#111',
                fontWeight:700, fontSize:15, borderRadius:10, border:'none', cursor:'pointer'}}
              onClick={() => router.push('/store/baegun/login')}
            >
              할인받고 주문하기
            </button>
            <button
              style={{padding:'12px 16px', background:'none', color:'#666',
                fontSize:13, border:'1px solid #333', borderRadius:10, cursor:'pointer'}}
              onClick={() => setShowLoginBanner(false)}
            >
              닫기
            </button>
          </div>
          <div style={{fontSize:12, color:'#555', marginTop:2}}>
            📱 카카오 로그인은 준비 중이에요 (곧 추가될 예정)
          </div>
        </div>
      )}

      {/* 진행 중인 더치페이 참여 배너 (방식 B: 각자 폰으로 합류) */}
      {splitSession && (
        <div
          onClick={() => router.push(`/store/baegun/split?sid=${splitSession.id}`)}
          style={{
            background: '#101820', border: '1px solid #7fd4ff66', borderRadius: 12,
            padding: '14px 16px', margin: '12px 16px 0', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <span style={{ fontSize: 24 }}>🍗</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#7fd4ff' }}>이 테이블에 진행 중인 더치페이가 있어요!</div>
            <div style={{ fontSize: 12, color: '#888' }}>{splitSession.paid_count}/{splitSession.participant_count}명 결제 완료 · 눌러서 참여하기</div>
          </div>
          <span style={{ color: '#7fd4ff' }}>›</span>
        </div>
      )}

      {/* 추가정보(생일·주소) 입력 유도 카드 — phone_member/profile_incomplete 회원에게만 */}
      <ProfilePrompt />

      {/* 메뉴 목록 */}
      <div className="menu-list">
        {CATS.map(cat => {
          const catMenus = menus.filter(m => m.category === cat && m.is_available !== false)
          if (!catMenus.length) return null
          return (
            <div key={cat} ref={el => { catRefs.current[cat] = el }} style={{ scrollMarginTop: headerH }}>
              <div className="section-header">{CAT_DISPLAY[cat]?.icon ?? CAT_ICONS[cat]} {CAT_DISPLAY[cat]?.label ?? cat}</div>
              {catMenus.map(item => (
                <div key={item.id} className={`menu-item${!item.is_available ? ' sold-out' : ''}`}>
                  <div className="menu-thumb" style={{ width: 92, height: 92, flexShrink: 0, borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' }}>
                    {NO_IMAGE_NAMES.includes(item.name)
                      ? null
                      : item.image_url
                        ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 36 }}>{CAT_ICONS[item.category]}</span>}
                  </div>
                  <div className="menu-info">
                    <div className="menu-name">{item.name}</div>
                    <div className="menu-price">{item.price.toLocaleString()}원</div>
                    {!item.is_available && <div className="menu-tag">품절</div>}
                  </div>
                  <div className="qty-ctrl">
                    {getQty(item.id) > 0 && (
                      <>
                        <button onClick={() => handleQty(item, -1)}>-</button>
                        <span>{getQty(item.id)}</span>
                      </>
                    )}
                    <button className="plus" onClick={() => handleQty(item, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* 법적 고지 푸터 */}
      <LegalFooter />

      {/* 직원 호출 버튼 */}
      <button className="call-fab" onClick={() => setShowCall(true)} style={{
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, width:60
      }}>
        🔔
        <span style={{fontSize:10, color:'#aaa'}}>직원호출</span>
      </button>

      {/* 장바구니 플로팅 버튼 */}
      {totalQty > 0 && (
        <button className="cart-fab" onClick={() => router.push('/store/baegun/cart')}>
          <span>🛒 {totalQty}개 담음</span>
          <span>{finalAmount.toLocaleString()}원 →</span>
        </button>
      )}

      {/* 직원 호출 시트 */}
      {showCall && (
        <div className="overlay" onClick={() => setShowCall(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-title">무엇이 필요하세요?</div>
            {['💧 물 주세요', '🥗 치킨무 추가', '🧻 물티슈 주세요', '👋 직원 직접 호출'].map(t => (
              <button key={t} className="sheet-btn" onClick={() => {
                try {
                  // eslint-disable-next-line
                  const textOnly = t.replace(new RegExp('[\\p{Emoji_Presentation}\\p{Extended_Pictographic}]', 'gu'), '').trim()
                  const u = new SpeechSynthesisUtterance(`${tableNo}번 테이블 ${textOnly} 호출입니다`)
                  u.lang = 'ko-KR'; u.volume = 1; u.rate = 0.9
                  window.speechSynthesis.speak(u)
                  const ctx = new AudioContext()
                  ;[880, 1100].forEach((freq, i) => {
                    const osc = ctx.createOscillator()
                    const g = ctx.createGain()
                    osc.connect(g); g.connect(ctx.destination)
                    osc.frequency.value = freq
                    g.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.2)
                    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.15)
                    osc.start(ctx.currentTime + i * 0.2)
                    osc.stop(ctx.currentTime + i * 0.2 + 0.2)
                  })
                } catch {}
                setShowCall(false)
              }}>{t}</button>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
