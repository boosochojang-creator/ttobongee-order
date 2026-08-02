-- 025: 신규가입(signup) 쿠폰 1인 1장 보장 — 중복발급 원천차단
--
-- 배경: 쿠폰 자동배치(runCouponAutomation)가 짧은 시간에 두 번 실행되면
--   같은 회원에게 signup 쿠폰이 2장 발급되던 문제(2026-08 QA에서 7명 발견, 정리 완료).
--   코드도 개별 insert+충돌 무시로 하드닝했지만, DB 레벨에서 확실히 막는다.
--
-- 부분 유니크 인덱스: type='signup' 인 행에 한해 user_id 유일.
--   (birthday/revisit/vip_thanks 등 다른 타입은 제약 없음 — 여러 장 가능)
--
-- ※ 실행 전 중복이 남아있으면 인덱스 생성이 실패하므로, 아래 정리 쿼리를 먼저 돌린 뒤 인덱스를 만든다.
--   (2026-08-02 기준 중복은 이미 정리됨 — 재실행 안전용으로 함께 둠)

-- 1) 혹시 남은 signup 중복 정리: user별 가장 이른 1장만 남기고 삭제
DELETE FROM coupons c
USING (
  SELECT id,
         row_number() OVER (PARTITION BY user_id ORDER BY issued_at ASC, id ASC) AS rn
  FROM coupons
  WHERE type = 'signup'
) d
WHERE c.id = d.id AND d.rn > 1;

-- 2) 부분 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS uq_coupons_signup_per_user
  ON coupons (user_id)
  WHERE type = 'signup';
