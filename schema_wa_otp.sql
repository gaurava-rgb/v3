-- WhatsApp OTP verification codes
-- Run once in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS wa_otp_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT        NOT NULL,
  code_hash   TEXT        NOT NULL,   -- SHA-256(code), never store plaintext
  attempts    INT         NOT NULL DEFAULT 0,
  used        BOOLEAN     NOT NULL DEFAULT false,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_otp_phone ON wa_otp_codes(phone, used, expires_at);
