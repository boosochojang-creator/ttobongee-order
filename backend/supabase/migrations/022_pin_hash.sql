-- E그룹 마지막: 점주 PIN bcrypt 해시 전환 — 조회용 컬럼 추가 (기존 평문 pin_code 는 유지, 전환 확인 후 별도 지시로 제거)
-- pin_code_hash: bcrypt 해시 저장. 로그인/변경 검증은 서버에서 bcrypt.compare 로 수행.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pin_code_hash text;
