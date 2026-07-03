'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// 새로고침·앱 전환(결제앱 등) 후에도 장바구니가 사라지지 않도록 localStorage에 보존한다.
// 유효시간을 두는 이유: 어제 담아둔 장바구니가 오늘 방문 때 되살아나면 안 되므로 (한 끼 세션 기준 3시간)
export const CART_STORAGE_KEY = 'ttobongee-cart-v1'
const CART_MAX_AGE_MS = 3 * 60 * 60 * 1000

export type CartItem = {
  id: number
  name: string
  price: number
  qty: number
}

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

  // 1) 복원: 첫 화면 표시 직후 localStorage의 장바구니를 불러온다.
  //    테이블 QR로 새로 진입(?table=)한 경우는 새 손님/새 세션이므로 복원하지 않는다.
  useEffect(() => {
    try {
      const isNewTableEntry = new URLSearchParams(window.location.search).has('table')
      const raw = localStorage.getItem(CART_STORAGE_KEY)
      if (raw && !isNewTableEntry) {
        const saved = JSON.parse(raw)
        if (saved && Date.now() - (saved.savedAt || 0) < CART_MAX_AGE_MS) {
          if (Array.isArray(saved.items)) setItems(saved.items)
          if (saved.tableNo) setTableNo(saved.tableNo)
          if (saved.orderType) setOrderType(saved.orderType)
          if (saved.isMember && saved.userId) {
            setIsMember(true)
            setUserId(saved.userId)
            setPhone(saved.phone || '')
            setGrade(saved.grade || 'bronze')
            setVisitCount(saved.visitCount || 0)
          }
        }
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

  const clearCart = () => {
    setItems([])
    setIsMember(false)
    setUserId(null)
    setPhone('')
    setGrade('bronze')
    setVisitCount(0)
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
