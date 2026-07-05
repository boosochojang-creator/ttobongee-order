-- Phase 3 보완: orders.payment_method 제약에 'split' 추가 (Supabase SQL Editor에서 실행)
-- 배경: 실DB 제약이 card/kakao/toss/cash만 허용해 더치페이 주문 생성(payment_method='split')이 차단됨 (2026-07-05 실측)
-- 참고: 014에서 order_type 제약을 확장했던 것과 같은 방식

alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method in ('card', 'kakao', 'toss', 'cash', 'split'));
