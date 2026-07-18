-- 회원탈퇴(비식별화). users 행은 남기되 개인식별정보(phone/hash/encrypted/nickname/birthday/address/email)를
-- 파기하고, 주문·쿠폰 등 이력은 익명 shell에 연결된 채 보존한다(매출·통계 정합성 유지).
-- withdrawn_at: NULL=활성 회원, 값=탈퇴 시각(탈퇴 여부 판별 마커).
-- member_status는 CHECK 제약(phone_member/profile_incomplete/profile_complete)이 있어 별도 값을 쓰지 않고,
-- 탈퇴 판별은 withdrawn_at으로만 한다.
ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;
