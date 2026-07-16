-- A2: 테이블 다회주문 합산 / 결제 세션
-- 결제완료(세션 마감) 시각. 같은 테이블의 조리완료 주문들을 한 번에 결제완료하면
-- 동일한 closed_at을 공유 → distinct closed_at = 방문(visit) 세션 수.
-- 이 값이 CRM 방문 카운트·등급(tierOf)·쿠폰 자동발급의 기준이 된다(날짜 추정 방식 대체).
-- 컬럼이 없어도 앱은 best-effort로 동작(마감은 되지만 방문은 날짜로 폴백)하므로, 이 마이그레이션 적용 후 정식 세션 집계가 작동한다.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- 세션(같은 테이블·같은 결제시점) 조회 및 방문 집계 성능용
CREATE INDEX IF NOT EXISTS idx_orders_table_closed ON orders (table_no, closed_at);
CREATE INDEX IF NOT EXISTS idx_orders_user_closed ON orders (user_id, closed_at);
