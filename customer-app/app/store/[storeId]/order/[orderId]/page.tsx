"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type OrderItem = { menuId: string; name: string; unitPrice: number; qty: number };

type Order = {
  id: string;
  table_no: string;
  items: OrderItem[];
  total_price: number;
  status: string;
  created_at: string;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  pending:   { label: "접수 대기 중",   color: "var(--text-dim)", icon: "🕐" },
  confirmed: { label: "주문 확인됨",    color: "var(--orange)",  icon: "✅" },
  cooking:   { label: "조리 중",        color: "var(--gold)",    icon: "🍳" },
  ready:     { label: "준비 완료!",     color: "var(--green)",   icon: "🎉" },
  done:      { label: "완료",           color: "var(--text-dim)", icon: "🍗" },
};

function OrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ storeId: string; orderId: string }>();
  const { storeId, orderId } = params;
  const tableNo = searchParams.get("table") ?? "";

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("orders")
      .select("id, status, table_no, total_price, created_at, payment_method, items")
      .eq("id", orderId)
      .single()
      .then(({ data }) => {
        if (data) setOrder(data as Order);
        setLoading(false);
      });

    const channel = supabase
      .channel(`order-${orderId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `id=eq.${orderId}`,
      }, ({ new: next }) => {
        setOrder((prev) => prev ? { ...prev, ...(next as Order) } : null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  if (loading) {
    return (
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <span className="spinner" />
      </div>
    );
  }

  if (!order) {
    return (
      <main className="wrap" style={{ padding: "60px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>주문 정보를 찾을 수 없습니다.</p>
        <button className="btn-primary" onClick={() => router.push(`/store/${storeId}/menu?table=${tableNo}`)}>
          메뉴로 돌아가기
        </button>
      </main>
    );
  }

  const st = STATUS_MAP[order.status] ?? { label: order.status, color: "var(--text)", icon: "🍗" };

  return (
    <main className="wrap">
      {/* 상태 영역 */}
      <section style={{
        background: "linear-gradient(160deg, #1a1208 0%, #2c1d08 100%)",
        padding: "48px 24px 36px",
        textAlign: "center",
        borderBottom: "1px solid var(--line)",
      }}>
        <div style={{ fontSize: 60, lineHeight: 1, marginBottom: 14 }}>{st.icon}</div>
        <div style={{ fontSize: 23, fontWeight: 900, color: st.color, marginBottom: 8 }}>
          {st.label}
        </div>
        <div style={{ color: "var(--text-dim)", fontSize: 14 }}>{order.table_no}번 테이블</div>

        {/* 진행 바 */}
        {order.status !== "done" && (
          <div style={{
            margin: "20px auto 0",
            maxWidth: 260,
            height: 6, borderRadius: 10,
            background: "var(--line)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 10,
              background: `linear-gradient(90deg, var(--orange), ${st.color})`,
              width: `${
                order.status === "pending" ? "15%" :
                order.status === "confirmed" ? "40%" :
                order.status === "cooking" ? "70%" : "100%"
              }`,
              transition: "width 0.6s ease",
            }} />
          </div>
        )}
      </section>

      {/* 주문 내역 */}
      <section style={{ padding: "20px 14px" }}>
        <h2 style={{ fontSize: 14, color: "var(--text-dim)", fontWeight: 700, marginBottom: 12, padding: "0 2px" }}>
          주문 내역
        </h2>
        {order.items.map((item, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 16px",
            background: "var(--bg-card)",
            borderRadius: 14,
            border: "1px solid var(--line)",
            marginBottom: 8,
          }}>
            <div>
              <div style={{ fontWeight: 800 }}>{item.name}</div>
              <div style={{ color: "var(--text-dim)", fontSize: 13 }}>× {item.qty}</div>
            </div>
            <div style={{ color: "var(--gold)", fontWeight: 900, fontSize: 15 }}>
              {(item.unitPrice * item.qty).toLocaleString()}원
            </div>
          </div>
        ))}

        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 4px",
          borderTop: "1px solid var(--line)", marginTop: 6,
        }}>
          <span style={{ color: "var(--text-dim)" }}>총 합계</span>
          <span style={{ color: "var(--gold)", fontSize: 21, fontWeight: 900 }}>
            {order.total_price.toLocaleString()}원
          </span>
        </div>
      </section>

      {/* 추가 주문 */}
      <div style={{ padding: "4px 14px 44px" }}>
        <button
          className="btn-ghost"
          onClick={() => router.push(`/store/${storeId}/menu?table=${tableNo}`)}
        >
          + 추가 주문하기
        </button>
      </div>
    </main>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <span className="spinner" />
      </div>
    }>
      <OrderContent />
    </Suspense>
  );
}
