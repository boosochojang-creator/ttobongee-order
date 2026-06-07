"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { useCart } from "../../../lib/cartStore";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Menu = {
  id: string;
  category: string;
  name: string;
  price: number;
  is_sold_out: boolean;
};

const CATEGORIES = ["세트메뉴", "치킨류", "안주류", "주류&음료"];

function MenuContent() {
  const { storeId } = useParams<{ storeId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  // 전역 장바구니 훅
  const { items, addToCart, updateQty, setTableNo, totalQty, totalPrice } = useCart();

  const [menus, setMenus] = useState<Menu[]>([]);
  const [activeTab, setActiveTab] = useState("세트메뉴");
  const [loading, setLoading] = useState(true);

  // URL의 ?table=3 같은 테이블 번호를 받아 전역에 저장
  useEffect(() => {
    const table = searchParams.get("table");
    if (table) setTableNo(table);
  }, [searchParams, setTableNo]);

  useEffect(() => {
    async function fetchMenus() {
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .eq("store_id", storeId)
        .order("category");
      if (!error && data) setMenus(data);
      setLoading(false);
    }
    fetchMenus();
  }, [storeId]);

  const filtered = menus.filter((m) => m.category === activeTab);

  if (loading) return <div style={{ padding: 24, textAlign: "center" }}>메뉴 불러오는 중...</div>;

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{ background: "#c8a900", padding: "16px 20px" }}>
        <h1 style={{ color: "#fff", margin: 0, fontSize: 18 }}>또봉이통닭 백운역점</h1>
        <p style={{ color: "#fff9", margin: "4px 0 0", fontSize: 13 }}>회원 5% 할인 자동 적용</p>
      </div>

      {/* 카테고리 탭 */}
      <div style={{ display: "flex", borderBottom: "2px solid #eee", background: "#fff", position: "sticky", top: 0 }}>
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setActiveTab(cat)}
            style={{
              flex: 1, padding: "12px 4px", border: "none", background: "none",
              fontSize: 12, fontWeight: activeTab === cat ? 700 : 400,
              color: activeTab === cat ? "#c8a900" : "#666",
              borderBottom: activeTab === cat ? "2px solid #c8a900" : "none",
              cursor: "pointer"
            }}>
            {cat}
          </button>
        ))}
      </div>

      {/* 메뉴 목록 */}
      <div style={{ padding: "12px 16px" }}>
        {filtered.map((menu) => {
          // 이 메뉴가 장바구니에 담긴 수량 (없으면 0)
          const qty = items.find((c) => c.menuId === menu.id)?.qty ?? 0;
          return (
          <div key={menu.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 0", borderBottom: "1px solid #f0f0f0"
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: menu.is_sold_out ? "#bbb" : "#222" }}>
                {menu.name} {menu.is_sold_out && <span style={{ fontSize: 11, color: "#e44" }}>품절</span>}
              </div>
              <div style={{ fontSize: 14, color: "#c8a900", marginTop: 4 }}>
                {menu.price.toLocaleString()}원
              </div>
            </div>
            {/* 수량 조절: 0이면 + 만, 1개 이상이면 - 수량 + */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {qty > 0 && (
                <>
                  <button
                    onClick={() => updateQty(menu.id, qty - 1)}
                    style={{
                      width: 36, height: 36, borderRadius: "50%", border: "2px solid #c8a900",
                      background: "#fff", color: "#c8a900", fontSize: 22, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>−</button>
                  <span style={{ minWidth: 22, textAlign: "center", fontSize: 16, fontWeight: 600 }}>{qty}</span>
                </>
              )}
              <button
                onClick={() =>
                  !menu.is_sold_out &&
                  addToCart({ menuId: menu.id, name: menu.name, unitPrice: menu.price })
                }
                disabled={menu.is_sold_out}
                style={{
                  width: 36, height: 36, borderRadius: "50%", border: "2px solid #c8a900",
                  background: menu.is_sold_out ? "#eee" : "#fff",
                  color: "#c8a900", fontSize: 22, cursor: menu.is_sold_out ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>+</button>
            </div>
          </div>
          );
        })}
      </div>

      {/* 장바구니 버튼 → 장바구니 페이지 이동 */}
      {totalQty > 0 && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 40px)", maxWidth: 440 }}>
          <button
            onClick={() => router.push(`/store/${storeId}/cart`)}
            style={{
              width: "100%", padding: "16px", background: "#c8a900", color: "#fff",
              border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer"
            }}>
            장바구니 {totalQty}개 · {totalPrice.toLocaleString()}원
          </button>
        </div>
      )}
    </main>
  );
}

export default function MenuPage() {
  // useSearchParams를 쓰므로 Suspense로 감싼다
  return (
    <Suspense fallback={<div style={{ padding: 24, textAlign: "center" }}>불러오는 중...</div>}>
      <MenuContent />
    </Suspense>
  );
}
