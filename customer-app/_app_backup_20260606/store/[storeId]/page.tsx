"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

// 매장 메인
export default function StoreHome() {
  const { storeId } = useParams<{ storeId: string }>();

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1>매장 메인</h1>
      <p>매장 ID: {storeId}</p>
      <nav style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Link href={`/store/${storeId}/menu`}>메뉴 보기</Link>
        <Link href={`/store/${storeId}/cart`}>장바구니</Link>
        <Link href={`/store/${storeId}/order-status`}>주문 현황</Link>
      </nav>
    </main>
  );
}
