-- Привязка Telegram к профилю
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id bigint;

-- Временные коды верификации
CREATE TABLE IF NOT EXISTS telegram_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz DEFAULT now() NOT NULL
);
