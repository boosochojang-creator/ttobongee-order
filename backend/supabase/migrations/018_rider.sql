-- Phase 5-1-a: 라이더 배정 + 배달 상태 확장 (Supabase SQL Editor에서 실행 완료 · 2026-07-07)

-- 1. 라이더 (소수 1~2명, 토큰 링크 로그인)
create table if not exists riders (
  id           uuid primary key default uuid_generate_v4(),
  store_id     text references stores(id),
  name         text not null,
  phone        text,                    -- 라이더 실번호 (서버만 보유, 손님/타인 노출 금지)
  access_token text unique not null,    -- /rider?token=... 접속용
  is_active    boolean not null default true,
  created_at   timestamptz default now()
);

-- 2. 주문 ↔ 배정 라이더
alter table orders add column if not exists rider_id uuid references riders(id) on delete set null;

-- 3. 배달 상태 2개 추가 (기존 값 전부 유지 + out_for_delivery/delivered)
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in (
    'pending', 'paid', 'cash_pending',
    'accepted', 'cooking', 'done', 'served',
    'out_for_delivery', 'delivered',
    'verification_failed', 'canceled'
  ));
