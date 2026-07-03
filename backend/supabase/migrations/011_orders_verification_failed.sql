-- 그룹 D: 결제 서버 검증 — 금액 불일치/검증 실패 주문 분리용 상태 추가
-- Supabase SQL Editor에서 실행하세요.

alter table orders drop constraint if exists orders_status_check;

alter table orders add constraint orders_status_check
  check (status in (
    'pending', 'paid', 'cash_pending',
    'accepted', 'cooking', 'done', 'served',
    'verification_failed', 'canceled'
  ));
