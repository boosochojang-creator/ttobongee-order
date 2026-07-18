"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type OrderItem = { menuId: string; name: string; unitPrice: number; qty: number };

type Order = {
  id: string;
  store_id: string;
  table_no: string;
  items: OrderItem[];
  total_price: number;
  status: string;
  created_at: string;
  payment_method: string | null;
};

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID || "baegun";

const NEXT_STATUS: Record<string, string> = {
  pending: "awaiting_approval",
  awaiting_approval: "approved",
  approved: "cooking",
  cooking: "done",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "접수대기",
  awaiting_approval: "승인대기",
  approved: "승인완료",
  cooking: "조리중",
  done: "완료",
  canceled: "취소",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    supabase
      .from("orders")
      .select("*")
      .eq("store_id", STORE_ID)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setOrders(data as Order[]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    channelRef.current = supabase
      .channel("owner-orders")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `store_id=eq.${STORE_ID}`,
      }, (payload) => {
        const { eventType, new: next, old } = payload;
        if (eventType === "INSERT") {
          setOrders((prev) => [next as Order, ...prev]);
        } else if (eventType === "UPDATE") {
          setOrders((prev) =>
            prev.map((o) => (o.id === (next as Order).id ? (next as Order) : o))
          );
        } else if (eventType === "DELETE") {
          setOrders((prev) => prev.filter((o) => o.id !== (old as Order).id));
        }
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          retryTimerRef.current = setTimeout(() => setRetryCount((c) => c + 1), 5000);
        }
      });

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [retryCount]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    await fetch("/api/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setUpdating(null);
  };

  if (loading) {
    return <main style={{ padding: 24 }}><p>불러오는 중...</p></main>;
  }

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 20 }}>실시간 주문 목록</h1>
      {orders.length === 0 ? (
        <p style={{ color: "#888" }}>아직 주문이 없습니다.</p>
      ) : (
        orders.map((order) => {
          const next = NEXT_STATUS[order.status];
          return (
            <div
              key={order.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 16,
                marginBottom: 14,
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <strong>{order.table_no}번 테이블</strong>
                <span style={{ fontSize: 13, color: "#888" }}>
                  {new Date(order.created_at).toLocaleTimeString("ko-KR")}
                </span>
              </div>
              <div style={{ marginBottom: 10 }}>
                {(Array.isArray(order.items)
                  ? order.items
                  : typeof order.items === "string"
                  ? (JSON.parse(order.items) as OrderItem[])
                  : []
                ).map((item, i) => (
                  <div key={i} style={{ fontSize: 14, color: "#555" }}>
                    {item.name} × {item.qty} — {(item.unitPrice * item.qty).toLocaleString()}원
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>{(order.total_price ?? 0).toLocaleString()}원</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "#666" }}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                  {next && (
                    <button
                      onClick={() => updateStatus(order.id, next)}
                      disabled={updating === order.id}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "#ff6600",
                        color: "#fff",
                        border: "none",
                        fontSize: 13,
                        cursor: "pointer",
                        opacity: updating === order.id ? 0.6 : 1,
                      }}
                    >
                      {updating === order.id ? "처리 중..." : `→ ${STATUS_LABEL[next]}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </main>
  );
}
