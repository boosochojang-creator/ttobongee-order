'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import { MEMBER_KEY } from './pwaInstall'
import { computeHydration, CART_STORAGE_KEY, type CartItem } from './hydration'

// 장바구니 유지/회원 자동복원 순수 로직은 ./hydration 으로 분리(테스트 가능). 여기선 상태 배선만.
export { CART_STORAGE_KEY }
export type { CartItem }

type CartCtx = {
  items: CartItem[]
  tableNo: string
  orderType: string
  isMember: boolean
  userId: string | null
  phone: string
  grade: string
  visitCount: number
  addItem: (item: { id: number; name: string; price: number }) => void
  removeItem: (id: number) => void
  updateQty: (id: number, qty: number) => void
  clearCart: () => void
  clearItems: () => void
  setTableNo: (t: string) => void
  setOrderType: (t: string) => void
  setMember: (id: string, phone: string, grade?: string, visitCount?: number) => void
  totalQty: number
  totalAmount: number
  discountAmount: number
  finalAmount: number
}

const CartContext = createContext<CartCtx>({} as CartCtx)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [tableNo, setTableNo] = useState('0')
  const [orderType, setOrderType] = useState('dine_in')
  const [isMember, setIsMember] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [grade, setGrade] = useState('bronze')
  const [visitCount, setVisitCount] = useState(0)
  const [hydrated, setHydrated] = useState(false)

  // 1) 복원: 첫 화면 표시 직후 localStorage에서 장바구니 + 회원상태를 불러온다.
  //    장바구니는 새 테이블 진입(?table=)이면 새 세션이라 복원 안 함.
  //    회원상태는 영속(MEMBER_KEY)이라 QR 재진입이어도 항상 복원한다 — 재방문 회원 인식/5% 할인 (버그[1] 수정).
  useEffect(() => {
    try {
      const isNewTableEntry = new URLSearchParams(window.location.search).has('table')
      const h = computeHydration({
        cartRaw: localStorage.getItem(CART_STORAGE_KEY),
        memberRaw: localStorage.getItem(MEMBER_KEY),
        isNewTableEntry,
      })
      setItems(h.items)
      if (h.tableNo) setTableNo(h.tableNo)
      if (h.orderType) setOrderType(h.orderType)
      if (h.isMember && h.userId) {
        setIsMember(true)
        setUserId(h.userId)
        setPhone(h.phone)
        // 등급·방문횟수는 최신값을 DB에서 조회(배너 표시용). 실패해도 회원 인식/할인엔 영향 없음.
        supabase.from('users').select('grade, visit_count').eq('id', h.userId).single()
          .then(({ data }) => { if (data) { setGrade(data.grade || 'bronze'); setVisitCount(data.visit_count || 0) } })
      }
    } catch {}
    setHydrated(true)
  }, [])

  // 2) 저장: 복원이 끝난 뒤부터, 장바구니가 바뀔 때마다 localStorage에 기록
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
        items, tableNo, orderType, isMember, userId, phone, grade, visitCount,
        savedAt: Date.now(),
      }))
    } catch {}
  }, [hydrated, items, tableNo, orderType, isMember, userId, phone, grade, visitCount])

  const addItem = (item: { id: number; name: string; price: number }) => {
    setItems((prev) => {
      const found = prev.find((i) => i.id === item.id)
      if (found) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i))
      }
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const removeItem = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id))

  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) {
      removeItem(id)
    } else {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty } : i)))
    }
  }

  // 주문 완료 후 호출 — 장바구니(한 끼 세션)만 비운다.
  // 회원 정체성(isMember/userId/phone/grade/visitCount)은 '사람'의 영속 정보라 유지한다.
  // CartProvider는 layout에 상주해 재주문(SPA 이동)시 hydration이 재실행되지 않으므로,
  // 여기서 회원상태를 지우면 리로드 전까지 복구되지 않아 재주문이 비회원 취급됐다 (버그[1] 회귀 수정).
  const clearCart = () => {
    setItems([])
  }

  const clearItems = () => setItems([])

  const setMember = (id: string, ph: string, gr?: string, vc?: number) => {
    setIsMember(true)
    setUserId(id)
    setPhone(ph)
    if (gr !== undefined) setGrade(gr)
    if (vc !== undefined) setVisitCount(vc)
  }

  const totalQty = items.reduce((sum, i) => sum + i.qty, 0)
  const totalAmount = items.reduce((sum, i) => sum + i.price * i.qty, 0)
  const discountAmount = isMember ? Math.round(totalAmount * 0.05) : 0
  const finalAmount = totalAmount - discountAmount

  return (
    <CartContext.Provider
      value={{
        items,
        tableNo,
        orderType,
        isMember,
        userId,
        phone,
        grade,
        visitCount,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        clearItems,
        setTableNo,
        setOrderType,
        setMember,
        totalQty,
        totalAmount,
        discountAmount,
        finalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
