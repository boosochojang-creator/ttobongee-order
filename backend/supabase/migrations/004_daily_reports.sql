-- daily_reports 테이블 생성
-- Supabase SQL Editor에서 실행하세요.

create table if not exists daily_reports (
  id               serial primary key,
  store_id         text not null,
  date             date not null,
  start_time       timestamptz,
  end_time         timestamptz,
  total_sales      integer not null default 0,
  card_sales       integer not null default 0,
  cash_sales       integer not null default 0,
  kakao_sales      integer not null default 0,
  toss_sales       integer not null default 0,
  order_count      integer not null default 0,
  avg_order_value  integer not null default 0,
  created_at       timestamptz not null default now(),
  unique(store_id, date)
);

-- RLS 활성화
alter table daily_reports enable row level security;

-- anon 키로 CRUD 허용 (점주 앱 전용 테이블)
create policy "daily_reports_all" on daily_reports
  for all
  using (true)
  with check (true);
