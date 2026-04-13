-- User profiles — one row per verified phone number.
-- Run once in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS user_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        TEXT        UNIQUE NOT NULL,  -- E.164 digits, no + (matches wa_contacts.phone)
  display_name TEXT,                         -- editable by user
  wa_name      TEXT,                         -- original WhatsApp pushName (read-only seed)
  email        TEXT,                         -- linked @tamu.edu, nullable for now
  email_verified BOOLEAN   NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON user_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
