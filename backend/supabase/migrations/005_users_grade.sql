-- users 테이블 컬럼 추가 + orders FK + grade 초기화
-- Supabase SQL Editor에서 실행하세요.

-- 1. users 컬럼 추가
alter table users add column if not exists total_spent  integer not null default 0;
alter table users add column if not exists grade        text    not null default 'bronze';
alter table users add column if not exists visit_count  integer not null default 0;

-- 2. orders.user_id → users.id FK (없으면 추가)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_user_id_fkey'
  ) then
    alter table orders
      add constraint orders_user_id_fkey
      foreign key (user_id) references users(id) on delete set null;
  end if;
end $$;

-- 3. 기존 회원 grade 초기화
update users set grade = case
  when visit_count >= 10 then 'gold'
  when visit_count >= 5  then 'silver'
  else 'bronze'
end;
