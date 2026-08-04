-- 026: coupons.type CHECK 제약에 'connect'(소셜 계정연결 보상 쿠폰) 허용 추가
--
-- 배경: [2] 재방문 소셜연결 유도(2026-08)에서 연결 완료 시 'connect' 타입 쿠폰(콜라/사이다 택1)을
--   발급하도록 코드를 배포(e27500b)했으나, coupons.type CHECK 제약(coupons_type_check)이
--   'connect'를 허용하지 않아 insert가 23514로 거부되고 있었다(issueConnectCoupon은 best-effort
--   try/catch라 조용히 실패 → 연결해도 보상 쿠폰이 안 나옴). 제약에 'connect'를 추가해 정상화한다.
--
-- 허용 타입 = 앱이 실제 발급하는 전체 집합:
--   signup(신규가입) · birthday(생일) · revisit(재방문감사) · vip_thanks(단골감사) · connect(계정연결)
--   (현재 DB에 존재하는 타입은 signup·birthday뿐 — 재생성해도 기존 데이터 영향 없음)

ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_type_check;
ALTER TABLE coupons ADD CONSTRAINT coupons_type_check
  CHECK (type IN ('signup','birthday','revisit','vip_thanks','connect'));
