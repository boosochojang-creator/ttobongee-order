import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 서버 전용 라우트 — service_role 키로 RLS 우회하여 주문 상태를 UPDATE한다.
// service_role 키는 절대 클라이언트(브라우저)에 노출되지 않는다. (NEXT_PUBLIC_ 아님)

const VALID: Record<string, true> = {
  pending: true,
  confirmed: true,
  cooking: true,
  ready: true,
  served: true,
};

export async function POST(req: Request) {
  try {
    const { id, status } = await req.json();

    // 입력 검증
    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "id 누락" }, { status: 400 });
    }
    if (!status || !VALID[status]) {
      return NextResponse.json({ ok: false, error: "잘못된 status" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ ok: false, error: "서버 키 미설정" }, { status: 500 });
    }

    // service_role 클라이언트 (RLS 우회) — 서버에서만 생성
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await admin
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select("id, status");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ ok: false, error: "해당 주문 없음" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, order: data[0] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
