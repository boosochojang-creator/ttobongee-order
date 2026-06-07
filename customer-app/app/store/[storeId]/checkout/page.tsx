"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "@/lib/cartStore";

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId;
  const tableNo = searchParams.get("table") ?? "";

  const { items, updateQty, clearCart, totalPrice } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<"카드" | "현금">("카드");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleOrder = async () => {
    if (items.length === 0 || loading) return;
    setLoading(true);
    setError("");

    const id = crypto.randomUUID();
    const { error: err } = await supabase
      .from("orders")
      .insert({
        id,
        store_id: storeId,
        table_no: Number(tableNo),
        total_price: totalPrice,
        status: "pending",
        payment_method: paymentMethod,
      });

    if (err) {
      setError("주문 중 오류가 발생했습니다. 다시 시도해 주세요.");
      setLoading(false);
      return;
    }

    clearCart();
    router.push(`/store/${storeId}/order/${id}?table=${tableNo}`);
  };

  useEffect(() => {
    if (items.length === 0 && !loading) {
      router.replace(`/store/${storeId}/menu?table=${tableNo}`);
    }
  }, [items.length, loading]);

  return (
    <main className="wrap" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* 헤더 */}
      <header style={{
        display: "flex", alignItems: "center",
        padding: "14px 16px",
        borderBottom: "1px solid var(--line)",
        gap: 10,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: "var(--bg-card)", border: "1px solid var(--line)",
            width: 40, height: 40, minHeight: 40, borderRadius: 10, fontSize: 20,
            color: "var(--text)",
          }}
        >
          ←
        </button>
        <span style={{ fontWeight: 900, fontSize: 18 }}>장바구니</span>
        <span style={{
          marginLeft: "auto",
          background: "var(--bg-card)", border: "1px solid var(--line)",
          borderRadius: 100, padding: "4px 12px",
          color: "var(--text-dim)", fontSize: 13,
        }}>
          {tableNo}번 테이블
        </span>
      </header>

      {/* 아이템 목록 */}
      <div style={{ padding: "14px", flex: 1 }}>
        {items.map((item) => (
          <div key={item.menuId} style={{
            background: "var(--bg-card)",
            borderRadius: 16,
            border: "1px solid var(--line)",
            padding: "16px",
            marginBottom: 10,
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{item.name}</div>
              <div style={{ color: "var(--gold)", fontWeight: 900, fontSize: 15 }}>
                {(item.unitPrice * item.qty).toLocaleString()}원
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 2 }}>
                {item.unitPrice.toLocaleString()}원 × {item.qty}
              </div>
            </div>

            {/* 수량 조절 */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <button
                onClick={() => updateQty(item.menuId, item.qty - 1)}
                style={{
                  width: 38, height: 38, minHeight: 38, borderRadius: 10,
                  background: "var(--bg-card2)", border: "1px solid var(--line)",
                  color: item.qty === 1 ? "var(--red)" : "var(--text)",
                  fontSize: 20,
                }}
              >
                {item.qty === 1 ? "✕" : "−"}
              </button>
              <span style={{ fontSize: 18, fontWeight: 900, minWidth: 22, textAlign: "center" }}>
                {item.qty}
              </span>
              <button
                onClick={() => updateQty(item.menuId, item.qty + 1)}
                style={{
                  width: 38, height: 38, minHeight: 38, borderRadius: 10,
                  background: "var(--orange)", border: "none",
                  color: "#fff", fontSize: 20,
                }}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 합계 & 주문 */}
      <div style={{
        position: "sticky", bottom: 0,
        background: "var(--bg)", borderTop: "1px solid var(--line)",
        padding: "16px 14px 32px",
      }}>
        {/* 결제수단 선택 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["카드", "현금"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              style={{
                flex: 1, height: 40, minHeight: 40, borderRadius: 10, fontSize: 14, fontWeight: 700,
                background: paymentMethod === m ? "var(--orange)" : "var(--bg-card2)",
                color: paymentMethod === m ? "#fff" : "var(--text-dim)",
                border: paymentMethod === m ? "none" : "1.5px solid var(--line)",
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 14, padding: "0 4px",
        }}>
          <span style={{ color: "var(--text-dim)", fontSize: 15 }}>총 합계</span>
          <span style={{ color: "var(--gold)", fontSize: 23, fontWeight: 900 }}>
            {totalPrice.toLocaleString()}원
          </span>
        </div>
        {error && (
          <p style={{ color: "var(--red)", fontSize: 14, marginBottom: 10, textAlign: "center" }}>
            {error}
          </p>
        )}
        <button className="btn-primary" onClick={handleOrder} disabled={loading || items.length === 0}>
          {loading ? <span className="spinner" /> : `주문하기 · ${totalPrice.toLocaleString()}원`}
        </button>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <span className="spinner" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
