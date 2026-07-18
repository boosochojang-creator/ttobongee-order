'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '../../../lib/cartStore'
import { supabase } from '../../../lib/supabase'
import LegalFooter from '../../../lib/LegalFooter'
import ProfilePrompt from '../../../lib/ProfilePrompt'
import { getMemberLocal, greetingLabel } from '../../../lib/memberState'
import { fetchStoreClosed } from '../../../lib/storeStatus'
import { useStoreId } from '../../../lib/storeContext'

type MenuItem = { id: number; category: string; name: string; price: number; is_available: boolean; sold_out?: boolean; image_url?: string | null }

const CATS = ['세트메뉴', '치킨류', '안주류', '음료', '주류']
const CAT_ICONS: Record<string, string> = {
  '세트메뉴': '🔥',
  '치킨류': '🍗',
  '안주류': '🥘',
  '음료': '🥤',
  '주류': '🍺',
  '음료/주류': '🍺', // 구 카테고리 폴백(마이그레이션 전 데이터 안전)
}
// 표시명/아이콘 오버라이드 — 현재는 카테고리명이 곧 표시명(음료/주류 분리 완료)
const CAT_DISPLAY: Record<string, { label: string; icon: string }> = {}
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
  const storeId = useStoreId()
  const { addItem, updateQty, items, totalQty, finalAmount, tableNo, orderType, isMember, phone, nickname, grade, visitCount } = useCart()
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [activeCat, setActiveCat] = useState('세트메뉴')
  const [showLoginBanner, setShowLoginBanner] = useState(!isMember)
  // phone_member 이상(영구 가입 기록 보유)에게는 회원가입 문구를 절대 다시 안 띄움
  // (isMember는 3시간짜리 장바구니 상태라, 시간이 지난 회원에게 가입 배너가 재노출되던 허점 보완)
  const [isJoined, setIsJoined] = useState(false)
  useEffect(() => { setIsJoined(!!getMemberLocal()) }, [])

  // [2] 영업상태 — 마감 중이면 안내 배너(주문 하드차단은 결제화면에서). 마운트 조회 + 20초 폴링.
  const [storeClosed, setStoreClosed] = useState(false)
  useEffect(() => {
    let alive = true
    const check = () => fetchStoreClosed(storeId).then(c => { if (alive) setStoreClosed(c) })
    check()
    const t = setInterval(check, 20000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  // 더치페이 재설계: '각자 폰 합류' 세션 방식 폐기 → 참여 배너 제거(결제자 1명이 전액 결제).
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerH, setHeaderH] = useState(114)

  useEffect(() => {
    supabase.from('menus').select('*').eq('store_id', storeId).order('sort_order')
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
    // [2] 영업 준비 중이면 담기 차단 / [3] 재료 소진(sold_out) 메뉴는 추가 불가
    if (storeClosed) return
    if (delta > 0 && item.sold_out) return
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

      {/* [2] 영업마감 안내 배너 — 메뉴는 열람 가능, 주문은 결제화면에서 차단.
          앱 아이콘으로 들어온 회원이 처음 보는 화면이므로 영업시간·휴무·확인전화를 감성 톤으로 안내. */}
      {storeClosed && (
        <div style={{ margin: '12px 16px 0', background: '#2a1a00', border: '1px solid #c8a900', borderRadius: 12, padding: '16px 18px', fontSize: 14, lineHeight: 1.75, color: '#f0d890' }}>
          <div style={{ fontSize: 15.5, fontWeight: 900, color: '#FFD700', marginBottom: 6 }}>🍗 지금은 잠시 불을 끄고 준비 중이에요</div>
          바삭한 한 마리를 위해 재료를 손질하고 있어요.<br />
          아래 시간에 따끈하게 다시 찾아뵐게요 🙏
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #7a6400', fontSize: 13.5, color: '#e8cf88' }}>
            🕜 <b style={{ color: '#FFD700' }}>매일 오후 2시 30분 ~ 새벽 1시</b> <span style={{ color: '#c9b060' }}>(마지막 주문 밤 12시)</span><br />
            🌙 <b style={{ color: '#FFD700' }}>매주 월요일</b>은 쉬어갑니다
          </div>
          <div style={{ marginTop: 10, fontSize: 12.5, color: '#c9b060', lineHeight: 1.7 }}>
            혹시 영업 중인데 이 안내가 보인다면, 언제든 편하게 전화 주세요.<br />
            📞 <a href="tel:0322999848" style={{ color: '#FFD700', fontWeight: 700, textDecoration: 'none' }}>032-299-9848</a>
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #7a6400', fontSize: 12.5, color: '#9fd39f' }}>
            🎮 지금은 주문을 받지 않지만, <b style={{ color: '#b6e6a0' }}>오락실·음악감상실·게시판</b>은 언제든 즐기실 수 있어요! (오른쪽 아래 <b>&lsquo;잠깐 쉬었다 갈까요?&rsquo;</b>)
          </div>
        </div>
      )}

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
              {greetingLabel(nickname, phone)}님, 다시 오셨군요!
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
                onClick={() => router.push(`/store/${storeId}/profile`)}
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
            🎁 단골 등록하고 음료 1잔 무료 받기
          </div>
          <div style={{fontSize:15, color:'#ccc', lineHeight:1.7}}>
            전화번호 3초 입력으로 끝!<br/>
            {storeClosed
              ? <>다음 방문 때 <span style={{color:'#FF6B00', fontWeight:700}}>바로 사용</span>할 수 있어요</>
              : <>가입하면 <span style={{color:'#FF6B00', fontWeight:700}}>무료 증정 쿠폰</span>을 드려요</>}
          </div>
          <div style={{display:'flex', gap:8, marginTop:4}}>
            <button
              style={{flex:1, padding:'12px', background:'#c8a900', color:'#111',
                fontWeight:700, fontSize:15, borderRadius:10, border:'none', cursor:'pointer'}}
              onClick={() => router.push(`/store/${storeId}/login`)}
            >
              무료 받고 주문하기
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


      {/* 추가정보(생일·주소) 입력 유도 카드 — phone_member/profile_incomplete 회원에게만 */}
      <ProfilePrompt />

      {/* 메뉴 목록 */}
      <div className="menu-list">
        {CATS.map(cat => {
          // is_available=false = 메뉴에서 내린 항목(숨김 유지). [3] 재료 소진은 별도 sold_out으로 표시(아래).
          const catMenus = menus.filter(m => m.category === cat && m.is_available !== false)
          if (!catMenus.length) return null
          return (
            <div key={cat} ref={el => { catRefs.current[cat] = el }} style={{ scrollMarginTop: headerH }}>
              <div className="section-header">{CAT_DISPLAY[cat]?.icon ?? CAT_ICONS[cat]} {CAT_DISPLAY[cat]?.label ?? cat}</div>
              {catMenus.map(item => (
                <div key={item.id} className={`menu-item${item.sold_out ? ' sold-out' : ''}`}>
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
                    {item.sold_out && <div className="menu-tag">재료 소진</div>}
                  </div>
                  <div className="qty-ctrl">
                    {getQty(item.id) > 0 && (
                      <>
                        <button onClick={() => handleQty(item, -1)}>-</button>
                        <span>{getQty(item.id)}</span>
                      </>
                    )}
                    {/* [2] 영업 준비 중 또는 [3] 재료 소진이면 담기 버튼 비활성화 */}
                    <button className="plus" onClick={() => handleQty(item, 1)}
                      disabled={storeClosed || !!item.sold_out}
                      style={storeClosed || item.sold_out ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}>+</button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* 법적 고지 푸터 */}
      <LegalFooter />

      {/* 직원호출·허브는 전역 speed-dial(GlobalActionFab)로 통합 — 우측 +담기 버튼 가림 방지 */}

      {/* 장바구니 플로팅 버튼 — [2] 영업 준비 중이면 숨김(주문 불가) */}
      {totalQty > 0 && !storeClosed && (
        <button className="cart-fab" onClick={() => router.push(`/store/${storeId}/cart`)}>
          <span>🛒 {totalQty}개 담음</span>
          <span>{finalAmount.toLocaleString()}원 →</span>
        </button>
      )}

    </main>
  )
}
