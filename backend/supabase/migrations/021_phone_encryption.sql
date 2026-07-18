-- E2 단계1: 전화번호 암호화 컬럼 추가 (기존 phone/customer_phone 은 그대로 유지 — 나중에 별도 지시로 제거)
-- users: 조회용 해시(phone_hash) + 저장용 암호(phone_encrypted) 둘 다
-- orders.customer_phone: 조회 키로 안 쓰고 표시/문자에만 → 암호(customer_phone_encrypted)만
-- riders.phone: 현재 0행 → 구조만 맞춰둠(암호 컬럼)
-- 백필(기존 데이터 값 채우기)은 별도 Node 스크립트로 실행(AES-GCM을 앱 코드와 동일 방식으로 맞추기 위함).

ALTER TABLE users  ADD COLUMN IF NOT EXISTS phone_hash text;
ALTER TABLE users  ADD COLUMN IF NOT EXISTS phone_encrypted text;
-- 로그인/조회는 store_id + phone_hash 로 .eq() → 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users (store_id, phone_hash);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone_encrypted text;

ALTER TABLE riders ADD COLUMN IF NOT EXISTS phone_encrypted text;
