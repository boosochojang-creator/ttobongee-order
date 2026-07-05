-- Phase 3: 더치페이 — DDL 초안 (Supabase SQL Editor에서 실행)
-- 세션(테이블당 1건) + 몫(참여자당 1건, 동시 결제 경쟁·잔돈 유실·웹훅 중복 방지용)

create table if not exists split_payment_sessions (
  id                        uuid primary key default uuid_generate_v4(),
  table_order_id            uuid not null references orders(id) on delete cascade,
  total_amount              integer not null,
  participant_count         integer not null,
  amount_per_person         integer not null,
  last_payer_amount         integer not null,
  paid_count                integer not null default 0,
  is_member_pricing_applied boolean not null default false,
  status                    text not null default 'waiting'
                            check (status in ('waiting', 'partial_paid', 'all_paid')),
  created_at                timestamptz default now()
);

create index if not exists idx_split_sessions_order on split_payment_sessions(table_order_id);

create table if not exists split_payment_shares (
  id             uuid primary key default uuid_generate_v4(),
  session_id     uuid not null references split_payment_sessions(id) on delete cascade,
  share_index    integer not null,
  amount         integer not null,
  payment_id     text unique not null,
  status         text not null default 'pending'
                 check (status in ('pending', 'paid', 'canceled')),
  member_user_id uuid,
  created_at     timestamptz default now(),
  unique(session_id, share_index)
);

create index if not exists idx_split_shares_session on split_payment_shares(session_id);
