"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 루트: 입구 QR 진입 → 테이블 선택
export default function EntryPage() {
  const router = useRouter();
  const [tableNo, setTableNo] = useState("");

  const storeId = "baegun"; // 백운역점

  const goMenu = () => {
    if (!tableNo) return;
    router.push(`/store/${storeId}/menu?table=${tableNo}`);
  };

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1>또봉이통닭 백운역점</h1>
      <p>테이블 번호를 선택해 주세요.</p>
      <input
        type="number"
        placeholder="테이블 번호"
        value={tableNo}
        onChange={(e) => setTableNo(e.target.value)}
        style={{ width: "100%", padding: 12, fontSize: 18 }}
      />
      <button onClick={goMenu} style={{ width: "100%", padding: 16, marginTop: 12 }}>
        주문 시작하기
      </button>
    </main>
  );
}
