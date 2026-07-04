-- Phase 2: 배달 주문 — DDL 초안 (Supabase SQL Editor에서 실행)

-- 1. 매장 좌표 + 배달료 설정값 (배민 벤치마크, 하드코딩 금지 → DB 설정값으로 분리)
alter table stores add column if not exists lat double precision;
alter table stores add column if not exists lng double precision;
alter table stores add column if not exists delivery_settings jsonb not null default '{
  "tier1_max_m": 675,
  "tier1_fee": 3000,
  "tier2_max_m": 1900,
  "tier2_fee": 3500,
  "per_100m_fee": 80,
  "notice_distance_m": 20000
}'::jsonb;

-- 2. 주문에 배달 정보 컬럼
alter table orders add column if not exists delivery_address    text;      -- 도로명주소 + 상세주소
alter table orders add column if not exists delivery_fee        integer not null default 0;
alter table orders add column if not exists delivery_distance_m integer;   -- 실주행거리(m)
alter table orders add column if not exists customer_phone      text;      -- 표준 연락처 컬럼 (점주용 노출, 라이더 노출은 Phase 5에서 마스킹)
