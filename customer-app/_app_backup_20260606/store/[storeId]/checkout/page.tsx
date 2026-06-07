"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useCart } from "../../../lib/cartStore";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 결제
export default function CheckoutPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const router = useRouter();
  const { items, tableNo, totalQty, totalPrice, clearCart } = useCart();

  const [payment, setPayment] = useState<"card" | "cash">("card"); // 결제방법
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOrder() {
    if (items.length === 0) {
      setError("장바구니가 비어 있습니다.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      // 1) orders 테이블에 주문 1건 insert
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          store_id: storeId,
          table_no: tableNo,
          status: "pending",
          total_amount: totalPrice,
          payment_method: payment,
        })
        .select()
        .single();

      if (orderErr || !order) throw orderErr || new Error("주문 생성 실패");

      // 2) order_items 테이블에 장바구니 항목들 insert
      const orderItems = items.map((it) => ({
        order_id: order.id,
        menu_id: it.menuId,
        name_snapshot: it.name,
        price_snapshot: it.unitPrice,
        qty: it.qty,
      }));

      const { error: itemsErr } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsErr) throw itemsErr;

      // 3) 장바구니 비우고 주문현황으로 이동
      clearCart();
      router.push(`/store/${storeId}/order-status?orderId=${order.id}`);
    } catch (e: any) {
      setError("주문 처리 중 오류가 발생했습니다: " + (e?.message || "알 수 없는 오류"));
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 90, minHeight: "100vh" }}>
      {/* 헤더 */}
      <div style={{ background: "#c8a900", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}
        >‹</button>
        <h1 style={{ color: "#fff", margin: 0, fontSize: 18 }}>주문 확인</h1>
      </div>

      {/* 테이블 정보 */}
      {tableNo && (
        <div style={{ padding: "12px 16px", fontSize: 14, color: "#666", borderBottom: "1px solid #f0f0f0" }}>
          테이블 번호: <b style={{ color: "#222" }}>{tableNo}번</b>
        </div>
      )}

      {/* 주문내역 */}
      <div style={{ padding: "8px 16px" }}>
        <h2 style={{ fontSize: 15, margin: "12px 0" }}>주문 내역</h2>
        {items.length === 0 ? (
          <p style={{ color: "#999" }}>장바구니가 비어 있습니다.</p>
        ) : (
          items.map((it) => (
            <div key={it.menuId} style={{
              display: "flex", justifyContent: "space-between",
              padding: "10px 0", borderBottom: "1px solid #f5f5f5", fontSize: 14
            }}>
              <span>{it.name} × {it.qty}</span>
              <span style={{ fontWeight: 600 }}>{(it.unitPrice * it.qty).toLocaleString()}원</span>
            </div>
          ))
        )}
      </div>

      {/* 결제방법 선택 */}
      <div style={{ padding: "8px 16px" }}>
        <h2 style={{ fontSize: 15, margin: "12px 0" }}>결제 방법</h2>
        <div style={{ display: "flex", gap: 10 }}>
          {([["card", "카드"], ["cash", "현금"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPayment(val)}
              style={{
                flex: 1, padding: "14px", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer",
                border: payment === val ? "2px solid #c8a900" : "1.5px solid #ddd",
                background: payment === val ? "#fdf8e3" : "#fff",
                color: payment === val ? "#c8a900" : "#666",
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* 합계 */}
      <div style={{ padding: "16px", display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}>
        <span>총 결제금액 ({totalQty}개)</span>
        <span style={{ color: "#c8a900" }}>{totalPrice.toLocaleString()}원</span>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div style={{ padding: "0 16px 12px", color: "#e44", fontSize: 13 }}>{error}</div>
      )}

      {/* 주문하기 버튼 */}
      <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 40px)", maxWidth: 440 }}>
        <button
          onClick={handleOrder}
          disabled={submitting || items.length === 0}
          style={{
            width: "100%", padding: "16px",
            background: submitting || items.length === 0 ? "#ccc" : "#c8a900",
            color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700,
            cursor: submitting || items.length === 0 ? "not-allowed" : "pointer"
          }}
        >
          {submitting ? "주문 처리 중..." : `${totalPrice.toLocaleString()}원 주문하기`}
        </button>
      </div>
    </main>
  );
}
