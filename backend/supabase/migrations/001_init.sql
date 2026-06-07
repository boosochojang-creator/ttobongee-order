-- 또봉이통닭 백운역점 QR 주문 플랫폼 - 초기 스키마
-- Supabase / PostgreSQL

create extension if not exists "uuid-ossp";

-- 매장
create table if not exists stores (
  id          text primary key,           -- 예: 'baegun'
  name        text not null,
  address     text,
  is_open     boolean default true,
  created_at  timestamptz default now()
);

-- 사용자 (휴대폰 기반)
create table if not exists users (
  id          uuid primary key default uuid_generate_v4(),
  phone       text unique not null,
  nickname    text,
  created_at  timestamptz default now()
);

-- 메뉴
create table if not exists menus (
  id           uuid primary key default uuid_generate_v4(),
  store_id     text references stores(id) on delete cascade,
  category     text,                       -- 세트메뉴 / 치킨류 / 안주류 / 주류&음료
  name         text not null,
  price        integer not null,
  image_url    text,
  is_sold_out  boolean default false
);

-- 주문
create table if not exists orders (
  id              uuid primary key default uuid_generate_v4(),
  store_id        text references stores(id),
  user_id         uuid references users(id),
  table_no        integer,
  order_type      text,                    -- 매장 / 포장 등
  status          text not null default 'pending'
                  check (status in (
                    'pending', 'awaiting_approval', 'approved',
                    'paid', 'cash_pending', 'cooking', 'done', 'canceled'
                  )),
  total_amount    integer default 0,
  discount_amount integer default 0,
  final_amount    integer default 0,
  payment_id      text,
  created_at      timestamptz default now()
);

-- 주문 항목 (주문 시점 스냅샷 보존)
create table if not exists order_items (
  id              uuid primary key default uuid_generate_v4(),
  order_id        uuid references orders(id) on delete cascade,
  menu_id         uuid references menus(id),
  name_snapshot   text not null,
  price_snapshot  integer not null,
  qty             integer not null default 1
);

-- 결제
create table if not exists payments (
  id           uuid primary key default uuid_generate_v4(),
  order_id     uuid references orders(id) on delete cascade,
  method       text,                       -- card / cash 등
  amount       integer not null,
  pg_status    text,
  webhook_log  jsonb,
  created_at   timestamptz default now()
);

-- 조회 성능용 인덱스
create index if not exists idx_menus_store     on menus(store_id);
create index if not exists idx_orders_store    on orders(store_id);
create index if not exists idx_orders_status   on orders(status);
create index if not exists idx_order_items_ord on order_items(order_id);
create index if not exists idx_payments_order  on payments(order_id);
