"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 주문 진행 단계 (왼→오 순서대로 진행)
const STEPS = [
  { key: "pending", label: "주문 접수", desc: "점주 승인 대기 중" },
  { key: "confirmed", label: "주문 확인", desc: "주문이 확인되었습니다" },
  { key: "cooking", label: "조리 중", desc: "맛있게 조리하고 있어요" },
  { key: "ready", label: "조리 완료", desc: "곧 나갑니다" },
  { key: "served", label: "서빙 완료", desc: "맛있게 드세요!" },
];

function OrderStatusContent() {
  const { storeId } = useParams<{ storeId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [status, setStatus] = useState<string>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // orders 테이블 10초마다 폴링 (상태가 바뀌었는지 확인)
  useEffect(() => {
    if (!orderId) {
      setError("주문 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }

    let active = true;

    async function fetchStatus() {
      const { data, error: err } = await supabase
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .single();
      if (!active) return;
      if (err) {
        setError("주문 상태를 불러오지 못했습니다.");
      } else if (data) {
        setStatus(data.status);
      }
      setLoading(false);
    }

    fetchStatus();
    const timer = setInterval(fetchStatus, 3000); // 3초마다 폴링 (안전망)

    // Supabase Realtime 구독: 이 주문의 status가 바뀌면 즉시 반영
    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const next = (payload.new as { status?: string })?.status;
          if (active && next) setStatus(next);
        }
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const currentIdx = STEPS.findIndex((s) => s.key === status);
  const activeIdx = currentIdx < 0 ? 0 : currentIdx;

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 90, minHeight: "100vh" }}>
      {/* 헤더 */}
      <div style={{ background: "#c8a900", padding: "16px 20px" }}>
        <h1 style={{ color: "#fff", margin: 0, fontSize: 18 }}>주문 현황</h1>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "#999" }}>불러오는 중...</div>
      ) : error ? (
        <div style={{ padding: 48, textAlign: "center", color: "#e44" }}>{error}</div>
      ) : (
        <>
          {/* 현재 상태 큰 안내 */}
          <div style={{ padding: "28px 20px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#c8a900" }}>
              {STEPS[activeIdx].label}
            </div>
            <div style={{ fontSize: 14, color: "#666", marginTop: 8 }}>
              {STEPS[activeIdx].desc}
            </div>
          </div>

          {/* 단계 진행 표시 */}
          <div style={{ padding: "20px 24px" }}>
            {STEPS.map((step, idx) => {
              const done = idx < activeIdx;
              const active = idx === activeIdx;
              return (
                <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
                  {/* 동그라미 + 연결선 */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%",
                      background: done || active ? "#c8a900" : "#eee",
                      color: "#fff", fontSize: 13, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {done ? "✓" : idx + 1}
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div style={{
                        width: 2, height: 28,
                        background: idx < activeIdx ? "#c8a900" : "#eee",
                      }} />
                    )}
                  </div>
                  {/* 라벨 */}
                  <div style={{ paddingBottom: idx < STEPS.length - 1 ? 28 : 0 }}>
                    <div style={{
                      fontSize: 15,
                      fontWeight: active ? 700 : 500,
                      color: done || active ? "#222" : "#bbb",
                    }}>
                      {step.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 추가주문 버튼 */}
          <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 40px)", maxWidth: 440 }}>
            <button
              onClick={() => router.push(`/store/${storeId}/menu`)}
              style={{
                width: "100%", padding: "16px", background: "#c8a900", color: "#fff",
                border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer"
              }}
            >
              추가 주문하기
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default function OrderStatusPage() {
  // useSearchParams를 쓰므로 Suspense로 감싼다
  return (
    <Suspense fallback={<div style={{ padding: 24, textAlign: "center" }}>불러오는 중...</div>}>
      <OrderStatusContent />
    </Suspense>
  );
}
