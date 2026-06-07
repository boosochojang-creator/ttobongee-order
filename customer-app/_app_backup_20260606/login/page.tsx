"use client";

import { useState } from "react";

// 로그인 / 회원가입 (휴대폰 번호 기반)
export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");

  // TODO: users 테이블 upsert (phone unique)
  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1>로그인 / 회원가입</h1>
      <input
        placeholder="휴대폰 번호"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        style={{ width: "100%", padding: 12, marginBottom: 8 }}
      />
      <input
        placeholder="닉네임"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        style={{ width: "100%", padding: 12, marginBottom: 8 }}
      />
      <button style={{ width: "100%", padding: 16 }}>시작하기</button>
    </main>
  );
}
