-- [2] 웹푸시: PWA 푸시 구독 저장. 쿠폰 발급/영수증 알림 발송 대상.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id text NOT NULL,
  user_id uuid,               -- 회원 연결(있으면). 발송은 store_id+user_id로 조회.
  phone_hash text,            -- 보조 식별(회원 재로그인 대비)
  endpoint text NOT NULL UNIQUE,  -- 브라우저 푸시 엔드포인트(기기당 1개) — 중복 시 upsert
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions (store_id, user_id);
