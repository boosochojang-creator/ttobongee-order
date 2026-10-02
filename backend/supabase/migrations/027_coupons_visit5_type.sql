-- 027: coupons.type CHECK 제약에 'visit5'(5번째 방문 감사 쿠폰) 허용 추가
--
-- 배경: 2026-10 쿠폰 개편 — 기존 신규가입·생일·재방문·단골감사·계정연결 쿠폰은 신규 발급 중단
--   (이미 발급된 쿠폰은 그대로 사용 가능). 새 혜택 = 5·10·15…번째 방문마다 '소주 1병 / 생맥주 500cc 택1',
--   발급 즉시 당일 사용. 앱이 type='visit5'로 발급하므로 CHECK 제약에 추가한다(없으면 insert가 23514로 거부됨).
--
-- 기존 타입은 과거 발급분 보존을 위해 그대로 허용한다. 기존 데이터 영향 없음.

ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_type_check;
ALTER TABLE coupons ADD CONSTRAINT coupons_type_check
  CHECK (type IN ('signup','birthday','revisit','vip_thanks','connect','visit5'));
