"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 주문 상태 전이: pending → confirmed → cooking → ready → served
type Status = "pending" | "confirmed" | "cooking" | "ready" | "served";

// 주문 항목(메뉴 1줄) — DB order_items 스냅샷 컬럼
type OrderItem = {
  name_snapshot: string | null;
  price_snapshot: number | null;
  qty: number | null;
};

type Order = {
  id: string;
  store_id: string | null;
  table_no: number | null;
  status: Status;
  total_amount: number | null;
  payment_method: string | null;
  created_at: string;
  order_items: OrderItem[];
};

// 상태별 라벨/색상/다음 단계 정의
const FLOW: Record<Status, { label: string; color: string; next: Status | null; nextLabel: string | null }> = {
  pending:   { label: "신규 주문",  color: "#e2574c", next: "confirmed", nextLabel: "주문확인" },
  confirmed: { label: "접수됨",     color: "#e08e0b", next: "cooking",   nextLabel: "조리시작" },
  cooking:   { label: "조리 중",    color: "#c8a900", next: "ready",     nextLabel: "조리완료" },
  ready:     { label: "준비 완료",  color: "#2e8b57", next: "served",    nextLabel: "서빙완료" },
  served:    { label: "서빙 완료",  color: "#888",    next: null,        nextLabel: null },
};

const GOLD = "#c8a900";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // 주문 목록 조회 (최신순)
  const fetchOrders = useCallback(async () => {
    // order_items(메뉴 스냅샷)를 함께 조회 (중첩 select)
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, store_id, table_no, status, total_amount, payment_method, created_at, order_items(name_snapshot, price_snapshot, qty)"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setErr("주문 조회 오류: " + error.message);
    } else {
      setErr(null);
      // 진행 중 주문은 위로, 서빙완료(served)는 아래로 — 그 안에서는 최신순
      const list = ((data || []) as Order[]).slice().sort((a, b) => {
        const aDone = a.status === "served" ? 1 : 0;
        const bDone = b.status === "served" ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return b.created_at.localeCompare(a.created_at);
      });
      setOrders(list);
    }
    setLoading(false);
  }, []);

  // 상태 변경 버튼 → DB UPDATE
  async function advance(order: Order) {
    const step = FLOW[order.status];
    if (!step.next) return;
    setUpdatingId(order.id);
    // 화면 먼저 반영 (낙관적 업데이트)
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: step.next as Status } : o))
    );
    // service_role 서버 라우트로 UPDATE (RLS 우회 — anon 키 차단 회피)
    try {
      const res = await fetch("/api/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status: step.next }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErr("상태 변경 오류: " + (json?.error || res.status));
        fetchOrders(); // 실패 시 DB 기준으로 되돌림
      } else {
        setErr(null);
      }
    } catch (e) {
      setErr("상태 변경 오류: " + (e instanceof Error ? e.message : "네트워크 오류"));
      fetchOrders();
    }
    setUpdatingId(null);
  }

  useEffect(() => {
    fetchOrders();

    // 10초 폴링 (Realtime 누락 대비 안전망)
    const timer = setInterval(fetchOrders, 10000);

    // Supabase Realtime 구독 (신규 주문/상태변경 즉시 반영)
    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  function fmtTime(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, borderLeft: `4px solid ${GOLD}`, paddingLeft: 10 }}>
          실시간 주문 목록
        </h1>
        <button
          onClick={fetchOrders}
          style={{ background: "#fff", border: `1.5px solid ${GOLD}`, color: GOLD, borderRadius: 8, padding: "8px 14px", fontWeight: 600, cursor: "pointer" }}
        >
          새로고침
        </button>
      </div>

      {err && (
        <div style={{ background: "#fdecea", color: "#c0392b", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          {err}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#999" }}>불러오는 중...</p>
      ) : orders.length === 0 ? (
        <p style={{ color: "#999" }}>아직 들어온 주문이 없습니다. 신규 주문이 들어오면 자동으로 표시됩니다.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {orders.map((o) => {
            const step = FLOW[o.status] || FLOW.pending;
            const isDone = o.status === "served"; // 서빙완료 주문은 흐리게
            return (
              <div
                key={o.id}
                style={{
                  border: "1px solid #eee",
                  borderLeft: `5px solid ${step.color}`,
                  borderRadius: 12,
                  padding: "16px 18px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  background: "#fff",
                  opacity: isDone ? 0.5 : 1, // served 완료 주문 흐리게
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ background: step.color, color: "#fff", fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>
                      {step.label}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>
                      {o.table_no != null ? `테이블 ${o.table_no}번` : "테이블 미지정"}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: "#999" }}>{fmtTime(o.created_at)}</span>
                </div>

                {/* 주문 메뉴 목록 (예: 양념통닭 ×2) */}
                <div style={{ background: "#faf8ef", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                  {o.order_items && o.order_items.length > 0 ? (
                    o.order_items.map((it, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#333", padding: "2px 0" }}>
                        <span>{it.name_snapshot ?? "메뉴"} <span style={{ color: GOLD, fontWeight: 700 }}>×{it.qty ?? 0}</span></span>
                        <span style={{ color: "#888" }}>{((it.price_snapshot ?? 0) * (it.qty ?? 0)).toLocaleString()}원</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: "#aaa" }}>메뉴 정보 없음</div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 14, color: "#555" }}>
                    결제: {o.payment_method === "cash" ? "현금" : "카드"}
                    {" · "}
                    <span style={{ color: GOLD, fontWeight: 700 }}>
                      {(o.total_amount ?? 0).toLocaleString()}원
                    </span>
                  </div>

                  {step.next ? (
                    <button
                      onClick={() => advance(o)}
                      disabled={updatingId === o.id}
                      style={{
                        background: updatingId === o.id ? "#ccc" : GOLD,
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "10px 16px",
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: updatingId === o.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {updatingId === o.id ? "처리 중..." : step.nextLabel}
                    </button>
                  ) : (
                    <span style={{ color: "#999", fontSize: 13, fontWeight: 600 }}>주문 완료</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
