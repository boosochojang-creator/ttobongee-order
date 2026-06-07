"use client";

// 전역 장바구니 상태 관리 (React Context)
// 메뉴 → 장바구니 → 체크아웃 페이지 이동 간 담은 메뉴/테이블번호를 유지한다.

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

// 장바구니 한 줄(메뉴 1종)을 나타내는 타입
export type CartItem = {
  menuId: string;   // 메뉴 고유 id
  name: string;     // 메뉴 이름
  unitPrice: number; // 단가
  qty: number;      // 수량
};

type CartContextType = {
  items: CartItem[];
  tableNo: string | null;
  addToCart: (item: { menuId: string; name: string; unitPrice: number }) => void;
  removeFromCart: (menuId: string) => void;
  updateQty: (menuId: string, qty: number) => void;
  clearCart: () => void;
  setTableNo: (t: string | null) => void;
  totalQty: number;
  totalPrice: number;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [tableNo, setTableNoState] = useState<string | null>(null);

  // 메뉴 담기: 이미 있으면 수량 +1, 없으면 새로 추가
  const addToCart = useCallback(
    (item: { menuId: string; name: string; unitPrice: number }) => {
      setItems((prev) => {
        const exist = prev.find((c) => c.menuId === item.menuId);
        if (exist) {
          return prev.map((c) =>
            c.menuId === item.menuId ? { ...c, qty: c.qty + 1 } : c
          );
        }
        return [...prev, { ...item, qty: 1 }];
      });
    },
    []
  );

  // 메뉴 삭제
  const removeFromCart = useCallback((menuId: string) => {
    setItems((prev) => prev.filter((c) => c.menuId !== menuId));
  }, []);

  // 수량 변경: 0 이하가 되면 목록에서 제거
  const updateQty = useCallback((menuId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((c) => c.menuId !== menuId)
        : prev.map((c) => (c.menuId === menuId ? { ...c, qty } : c))
    );
  }, []);

  // 장바구니 비우기 (주문 완료 후 호출)
  const clearCart = useCallback(() => setItems([]), []);

  const setTableNo = useCallback((t: string | null) => setTableNoState(t), []);

  const totalQty = useMemo(
    () => items.reduce((s, c) => s + c.qty, 0),
    [items]
  );
  const totalPrice = useMemo(
    () => items.reduce((s, c) => s + c.unitPrice * c.qty, 0),
    [items]
  );

  const value: CartContextType = {
    items,
    tableNo,
    addToCart,
    removeFromCart,
    updateQty,
    clearCart,
    setTableNo,
    totalQty,
    totalPrice,
  };

  // .ts 파일이라 JSX를 못 쓰므로 createElement로 Provider를 만든다
  return React.createElement(CartContext.Provider, { value }, children);
}

// 장바구니 훅: Provider 밖에서 쓰면 에러
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart는 CartProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}
