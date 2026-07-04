-- Phase 2 보완: order_type 제약에 'delivery' 추가
-- (실DB에 문서에 없던 orders_order_type_check가 존재 — 실측 허용값 dine_in/takeout에 delivery만 추가)
-- Supabase SQL Editor에서 실행하세요.

alter table orders drop constraint if exists orders_order_type_check;

alter table orders add constraint orders_order_type_check
  check (order_type in ('dine_in', 'takeout', 'delivery'));
