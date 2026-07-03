-- 그룹 C: 주문 상태에 '픽업/서빙완료(served)' 추가
-- Supabase SQL Editor에서 실행하세요.
-- 현재 제약(orders_status_check)의 실측 허용값 7개에 served만 더해 재생성합니다.

alter table orders drop constraint if exists orders_status_check;

alter table orders add constraint orders_status_check
  check (status in (
    'pending', 'paid', 'cash_pending',
    'accepted', 'cooking', 'done', 'served', 'canceled'
  ));
