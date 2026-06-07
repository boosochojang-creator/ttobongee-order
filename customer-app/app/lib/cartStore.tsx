'use client'
import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

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
  addItem: (item: { id: number; name: string; price: number }) => void
  removeItem: (id: number) => void
  updateQty: (id: number, qty: number) => void
  clearCart: () => void
  setTableNo: (t: string) => void
  setOrderType: (t: string) => void
  setMember: (id: string, phone: string) => void
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
  }

  const setMember = (id: string, ph: string) => {
    setIsMember(true)
    setUserId(id)
    setPhone(ph)
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
        addItem,
        removeItem,
        updateQty,
        clearCart,
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
