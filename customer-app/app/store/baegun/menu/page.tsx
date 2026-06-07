'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '../../../lib/cartStore'
import { supabase } from '../../../lib/supabase'

type MenuItem = { id: number; category: string; name: string; price: number; is_available: boolean }

const CATS = ['세트메뉴', '치킨류', '안주류', '음료/주류']
const CAT_ICONS: Record<string, string> = {
  '세트메뉴': '🔥',
  '치킨류': '🍗',
  '안주류': '🥘',
  '음료/주류': '🍺',
}
const FORTUNES = [
  '오늘 치킨 먹으면 좋은 일 생겨요 🍗',
  '생맥주 한 잔의 여유, 오늘 수고했어요 🍺',
  '또봉이 치킨은 당신의 하루를 응원합니다 💛',
  '지금이 바로 치킨 먹을 최고의 타이밍!',
]

export default function MenuPage() {
  const router = useRouter()
  const { addItem, updateQty, items, totalQty, finalAmount, tableNo, orderType, isMember } = useCart()
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [activeCat, setActiveCat] = useState('세트메뉴')
  const [showCall, setShowCall] = useState(false)
  const [showLoginBanner, setShowLoginBanner] = useState(!isMember)
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    supabase.from('menus').select('*').eq('store_id', 'baegun').order('sort_order')
      .then(({ data }) => { if (data) setMenus(data) })
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
      {/* 상단 헤더 */}
      <div className="top-bar">
        <span className="logo">🍗 또봉이</span>
        <span className="table-badge">{label}</span>
      </div>

      {/* 회원 유도 배너 */}
      {showLoginBanner && (
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

      {/* 카테고리 탭 */}
      <div className="cat-tabs">
        {CATS.map(c => (
          <button key={c} className={activeCat === c ? 'active' : ''} onClick={() => scrollToCat(c)}>
            {CAT_ICONS[c]} {c}
          </button>
        ))}
      </div>

      {/* 메뉴 목록 */}
      <div className="menu-list">
        {CATS.map(cat => {
          const catMenus = menus.filter(m => m.category === cat)
          if (!catMenus.length) return null
          return (
            <div key={cat} ref={el => { catRefs.current[cat] = el }}>
              <div className="section-header">{CAT_ICONS[cat]} {cat}</div>
              {catMenus.map(item => (
                <div key={item.id} className={`menu-item${!item.is_available ? ' sold-out' : ''}`}>
                  <div className="menu-thumb">{CAT_ICONS[item.category]}</div>
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
                  const u = new SpeechSynthesisUtterance(`${tableNo}번 테이블 ${t} 호출입니다`)
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
