"use client";

import Link from "next/link";

// 대시보드 (주문현황)
export default function Dashboard() {
  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>점주 대시보드</h1>
      <p>또봉이통닭 백운역점 관리자</p>
      <nav style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        <Link href="/orders">실시간 주문 목록</Link>
        <Link href="/menu-manage">메뉴·품절 관리</Link>
        <Link href="/store-settings">영업시간·매장정보</Link>
        <Link href="/qr-manage">QR코드 출력 관리</Link>
      </nav>
    </main>
  );
}
