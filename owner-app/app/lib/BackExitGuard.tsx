'use client'
// 뒤로가기 실수 방지(2026-10) — 처음 들어온 화면에서 휴대폰 뒤로가기를 누르면 바로 닫히지 않고
// "나가시겠어요? [계속 보기] [✕ 나가기]" 창을 띄운다. (웹은 유튜브처럼 '축소'가 불가 → 확인창 방식)
//  · 원리: 손님이 화면을 처음 만질 때(브라우저가 사용자 동작 없이 쌓은 기록은 뒤로가기에서 건너뜀)
//    지금 기록을 '바닥'으로 표시하고 같은 화면 기록을 한 칸 더 쌓는다. 바닥까지 내려오면 창을 띄우고 다시 한 칸 쌓음.
//  · [나가기]: 바닥으로 내려가 창을 닫아 보고(브라우저가 허용할 때만), 안 닫히면 "뒤로가기를 한 번 더" 안내.
//  · 주문 중 확인창(OrderSessionBell)이 같은 순간에 뜨면 그쪽에 양보(창 두 개 방지).
import { useEffect, useRef, useState } from 'react'

const ARMED_KEY = 'eoul-back-armed'

export default function BackExitGuard({ title = '나가시겠어요?', sub = '실수로 누르셨다면 [계속 보기]를 눌러 주세요.' }: { title?: string; sub?: string }) {
  const [ask, setAsk] = useState(false)
  const [hint, setHint] = useState(false)
  const leaving = useRef(false)

  useEffect(() => {
    // __NA: Next.js가 '자기 기록'으로 알아보는 표시. 화면이 직접 바꾼 기록(예: 점주 탭 ?tab=)엔 이 표시가 없어서,
    //   그 기록으로 뒤로 오면 Next.js가 페이지를 새로 고쳐 버림(확인창이 뜨기 전에 사라짐) → 우리 기록엔 꼭 붙인다.
    const push = () => { try { window.history.pushState({ ...(window.history.state || {}), __NA: true, __eoulTop: true, __eoulBase: false }, '', window.location.href) } catch {} }
    const arm = () => {
      try { if (sessionStorage.getItem(ARMED_KEY) === '1') return; sessionStorage.setItem(ARMED_KEY, '1') } catch {}
      try { window.history.replaceState({ ...(window.history.state || {}), __NA: true, __eoulBase: true }, '', window.location.href) } catch {}
      push()
    }
    const onGesture = () => { arm(); off() }
    const off = () => ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.removeEventListener(ev, onGesture, true))
    ;['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, onGesture, true))

    const onPop = (e: PopStateEvent) => {
      if (leaving.current) return
      if (!e.state?.__eoulBase) return
      // 다른 확인창(주문 중 뒤로가기)이 먼저 처리했으면 양보
      setTimeout(() => {
        if (window.history.state?.__orderGuard || window.history.state?.__immersive) return
        push()
        setAsk(true)
      }, 0)
    }
    window.addEventListener('popstate', onPop)
    return () => { off(); window.removeEventListener('popstate', onPop) }
  }, [])

  const stay = () => setAsk(false)
  const leave = () => {
    leaving.current = true
    setAsk(false)
    try { window.history.back() } catch {} // 바닥 기록으로(다음 뒤로가기 = 진짜 나가기)
    setTimeout(() => {
      try { window.close() } catch {} // 브라우저가 허용하는 경우(앱처럼 연 창)에만 닫힘
      setHint(true)
      // 안 나가고 계속 쓰면 다음번엔 다시 확인창
      setTimeout(() => { setHint(false); leaving.current = false }, 4000)
    }, 150)
  }

  return (
    <>
      {ask && (
        <div onClick={stay} style={{ position: 'fixed', inset: 0, zIndex: 3500, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
            style={{ width: '100%', maxWidth: 480, background: '#1c1c1c', borderRadius: '20px 20px 0 0', borderTop: '1.5px solid #c8a900', padding: '22px 18px calc(22px + env(safe-area-inset-bottom, 0px))' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 13, color: '#aaa', marginBottom: 18 }}>{sub}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={stay} autoFocus
                style={{ flex: 2, padding: '14px 0', borderRadius: 12, border: 'none', background: '#c8a900', color: '#111', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>계속 보기</button>
              <button onClick={leave}
                style={{ flex: 1, padding: '14px 0', borderRadius: 12, border: '1px solid #444', background: '#2a2a2a', color: '#ddd', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>✕ 나가기</button>
            </div>
          </div>
        </div>
      )}
      {hint && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', zIndex: 3500, background: '#222', color: '#fff', border: '1px solid #555', borderRadius: 999, padding: '10px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
          휴대폰 뒤로가기를 한 번 더 누르면 닫혀요
        </div>
      )}
    </>
  )
}
