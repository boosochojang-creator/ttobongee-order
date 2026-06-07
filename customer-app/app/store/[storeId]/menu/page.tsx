"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "@/lib/cartStore";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
};

function MenuContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId;
  const tableNo = searchParams.get("table") ?? "";

  const { items, addToCart, setTableNo, totalQty, totalPrice } = useCart();

  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("전체");

  useEffect(() => {
    if (!tableNo) { router.replace("/"); return; }
    setTableNo(tableNo);

    supabase
      .from("menus")
      .select("*")
      .eq("store_id", storeId)
      .then(({ data }) => {
        if (data) setMenus(data as MenuItem[]);
        setLoading(false);
      });
  }, [storeId, tableNo, setTableNo, router]);

  const categories = ["전체", ...Array.from(new Set(menus.map((m) => m.category)))];
  const filtered = activeCategory === "전체" ? menus : menus.filter((m) => m.category === activeCategory);
  const cartItem = (id: string) => items.find((i) => i.menuId === id);

  return (
    <main className="wrap">
      {/* 헤더 */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "var(--bg)",
        borderBottom: "1px solid var(--line)",
        padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontWeight: 900, fontSize: 17, color: "var(--orange)" }}>또봉이통닭</span>
        <span style={{
          background: "var(--bg-card)",
          border: "1px solid var(--line)",
          borderRadius: 100,
          padding: "5px 14px",
          fontSize: 13,
          color: "var(--text-dim)",
        }}>
          {tableNo}번 테이블
        </span>
      </header>

      {/* 카테고리 탭 */}
      <div
        className="tabs-scroll"
        style={{ borderBottom: "1px solid var(--line)", position: "sticky", top: 53, zIndex: 40, background: "var(--bg)" }}
      >
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              flexShrink: 0,
              padding: "0 18px",
              borderRadius: 100,
              fontSize: 14,
              minHeight: 36,
              height: 36,
              fontWeight: 700,
              background: activeCategory === cat ? "var(--orange)" : "var(--bg-card)",
              color: activeCategory === cat ? "#fff" : "var(--text-dim)",
              border: activeCategory === cat ? "none" : "1.5px solid var(--line)",
              transition: "all 0.12s",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 메뉴 목록 */}
      <div style={{ padding: "14px 14px", paddingBottom: totalQty > 0 ? 120 : 24 }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 112, marginBottom: 10 }} />
          ))
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text-dim)", padding: "60px 0" }}>
            메뉴가 없습니다
          </p>
        ) : (
          filtered.map((menu) => {
            const inCart = cartItem(menu.id);
            return (
              <div
                key={menu.id}
                style={{
                  background: "var(--bg-card)",
                  borderRadius: 16,
                  border: `1px solid ${inCart ? "var(--orange)" : "var(--line)"}`,
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  padding: "14px",
                  gap: 14,
                  transition: "border-color 0.12s",
                }}
              >
                {/* 이미지 */}
                <div style={{
                  width: 78, height: 78, borderRadius: 12,
                  background: "var(--bg-card2)",
                  flexShrink: 0, overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {menu.image_url
                    ? <img src={menu.image_url} alt={menu.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 32 }}>🍗</span>
                  }
                </div>

                {/* 정보 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 3 }}>{menu.name}</div>
                  {menu.description && (
                    <div style={{
                      color: "var(--text-dim)", fontSize: 12, marginBottom: 6,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {menu.description}
                    </div>
                  )}
                  <div style={{ color: "var(--gold)", fontWeight: 900, fontSize: 16 }}>
                    {menu.price.toLocaleString()}원
                  </div>
                </div>

                {/* 담기 버튼 */}
                <button
                  onClick={() => addToCart({ menuId: menu.id, name: menu.name, unitPrice: menu.price })}
                  style={{
                    width: 42, height: 42, minHeight: 42,
                    borderRadius: 12, fontSize: 24,
                    background: inCart ? "var(--orange)" : "var(--bg-card2)",
                    color: inCart ? "#fff" : "var(--text-dim)",
                    border: inCart ? "none" : "1.5px solid var(--line)",
                    flexShrink: 0, position: "relative",
                  }}
                >
                  +
                  {inCart && (
                    <span style={{
                      position: "absolute", top: -7, right: -7,
                      background: "var(--gold)", color: "#000",
                      borderRadius: "50%", width: 20, height: 20,
                      fontSize: 11, fontWeight: 900,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {inCart.qty}
                    </span>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 장바구니 바 */}
      {totalQty > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 480,
          padding: "12px 14px 28px",
          background: "var(--bg)", borderTop: "1px solid var(--line)",
          zIndex: 100,
        }}>
          <button
            className="btn-primary"
            onClick={() => router.push(`/store/${storeId}/checkout?table=${tableNo}`)}
          >
            장바구니 · {totalQty}개 · {totalPrice.toLocaleString()}원 →
          </button>
        </div>
      )}
    </main>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <span className="spinner" />
      </div>
    }>
      <MenuContent />
    </Suspense>
  );
}
