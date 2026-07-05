-- Phase 4-A: 회원 CRM 집계 컬럼 (Supabase SQL Editor에서 실행 완료 · 2026-07-05)
-- 기존 재사용: visit_count(총 방문횟수), total_spent(총 주문금액), last_visit(최근 방문일),
--   member_status(프로필 상태), marketing_opt_in, address_saved, birthday_saved
-- 신규 추가분만 정의 (전부 기본값 있어 기존 데이터 안전)
-- 주의: favorite_menu_id는 integer로 실행함 — menus.id(uuid)와 타입이 달라 참조 불가.
--   선호메뉴는 저장하지 않고 조회 시 order_items에서 계산한다(현재 이 컬럼은 미사용).
-- 휴면/휴면주의는 저장하지 않고 조회 시 last_visit로 계산한다(D2).

alter table users add column if not exists total_order_count   integer not null default 0;
alter table users add column if not exists average_order_amount integer not null default 0;
alter table users add column if not exists first_order_at       timestamptz;
alter table users add column if not exists last_order_at        timestamptz;
alter table users add column if not exists favorite_menu_id     integer;   -- 미사용(타입상 uuid 참조 불가)
alter table users add column if not exists customer_grade       text not null default 'new';
alter table users add column if not exists nickname             text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_customer_grade_check') then
    alter table users add constraint users_customer_grade_check
      check (customer_grade in ('new', 'normal', 'regular', 'vip'));
  end if;
end $$;

create index if not exists idx_users_store_grade on users(store_id, customer_grade);
