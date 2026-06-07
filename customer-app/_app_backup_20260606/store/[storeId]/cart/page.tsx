"use client";

import { useParams, useRouter } from "next/navigation";
import { useCart } from "../../../lib/cartStore";

// 장바구니
export default function CartPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const router = useRouter();
  const { items, updateQty, removeFromCart, totalQty, totalPrice } = useCart();

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 90, minHeight: "100vh" }}>
      {/* 헤더 */}
      <div style={{ background: "#c8a900", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => router.push(`/store/${storeId}/menu`)}
          style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}
        >‹</button>
        <h1 style={{ color: "#fff", margin: 0, fontSize: 18 }}>장바구니</h1>
      </div>

      {/* 빈 장바구니 */}
      {items.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", color: "#999" }}>
          <p>담은 메뉴가 없습니다.</p>
          <button
            onClick={() => router.push(`/store/${storeId}/menu`)}
            style={{
              marginTop: 12, padding: "12px 24px", background: "#c8a900", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer"
            }}
          >메뉴 보러가기</button>
        </div>
      ) : (
        <>
          {/* 장바구니 목록 */}
          <div style={{ padding: "8px 16px" }}>
            {items.map((it) => (
              <div key={it.menuId} style={{
                padding: "16px 0", borderBottom: "1px solid #f0f0f0"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "#222" }}>{it.name}</div>
                  <button
                    onClick={() => removeFromCart(it.menuId)}
                    style={{ background: "none", border: "none", color: "#bbb", fontSize: 13, cursor: "pointer" }}
                  >삭제</button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  {/* 수량 +/- */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => updateQty(it.menuId, it.qty - 1)}
                      style={{
                        width: 30, height: 30, borderRadius: "50%", border: "1.5px solid #c8a900",
                        background: "#fff", color: "#c8a900", fontSize: 18, cursor: "pointer"
                      }}
                    >−</button>
                    <span style={{ minWidth: 24, textAlign: "center", fontSize: 15 }}>{it.qty}</span>
                    <button
                      onClick={() => updateQty(it.menuId, it.qty + 1)}
                      style={{
                        width: 30, height: 30, borderRadius: "50%", border: "1.5px solid #c8a900",
                        background: "#fff", color: "#c8a900", fontSize: 18, cursor: "pointer"
                      }}
                    >+</button>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#c8a900" }}>
                    {(it.unitPrice * it.qty).toLocaleString()}원
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 합계 */}
          <div style={{ padding: "16px", display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}>
            <span>합계 ({totalQty}개)</span>
            <span style={{ color: "#c8a900" }}>{totalPrice.toLocaleString()}원</span>
          </div>

          {/* 주문하기 버튼 → 체크아웃 */}
          <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 40px)", maxWidth: 440 }}>
            <button
              onClick={() => router.push(`/store/${storeId}/checkout`)}
              style={{
                width: "100%", padding: "16px", background: "#c8a900", color: "#fff",
                border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer"
              }}
            >
              주문하기 · {totalPrice.toLocaleString()}원
            </button>
          </div>
        </>
      )}
    </main>
  );
}
