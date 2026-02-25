-- Aggie Connect v3 Schema
-- Run this in the Supabase SQL editor before starting the bot.
-- monitored_groups is shared with v2 — do NOT re-run its create statement if it already exists.

-- ── v3_requests ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS v3_requests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source              TEXT        NOT NULL,
  source_group        TEXT,
  source_contact      TEXT,
  sender_name         TEXT,
  request_type        TEXT,                        -- 'need' | 'offer'
  request_category    TEXT,                        -- 'ride' | 'help' | ...
  ride_plan_date      DATE,
  ride_plan_time      TEXT        DEFAULT NULL,    -- HH:MM 24h, null if not given
  date_fuzzy          BOOLEAN     DEFAULT false,   -- true if user gave flexible dates
  possible_dates      TEXT[]      DEFAULT '{}',    -- YYYY-MM-DD array when date_fuzzy
  time_fuzzy          BOOLEAN     DEFAULT false,   -- true if time approximate or missing
  request_origin      TEXT,
  request_destination TEXT,
  request_details     JSONB,
  raw_message         TEXT,
  request_status      TEXT        DEFAULT 'open',  -- 'open' | 'matched'
  request_hash        TEXT        UNIQUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── v3_matches ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS v3_matches (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id       UUID        REFERENCES v3_requests(id) ON DELETE CASCADE,
  offer_id      UUID        REFERENCES v3_requests(id) ON DELETE CASCADE,
  score         FLOAT       DEFAULT 1.0,
  match_quality TEXT        DEFAULT 'medium',      -- 'strong' | 'medium' | 'low'
  notified      BOOLEAN     DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── v3_message_log ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS v3_message_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id   TEXT,
  source_group    TEXT,
  source_contact  TEXT,
  sender_name     TEXT,
  message_text    TEXT,
  is_request      BOOLEAN,
  parsed_data     JSONB,
  error           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── outbound_queue ──────────────────────────────────────────────────────────
-- Schema prep for future outbound bot (v3.1). Not used by the monitoring bot.

CREATE TABLE IF NOT EXISTS outbound_queue (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact             TEXT        NOT NULL,
  channel             TEXT        NOT NULL DEFAULT 'whatsapp',
  message_type        TEXT        NOT NULL,
  -- 'nudge_time' | 'nudge_date' | 'cluster_alert' | 'match_notify' | 'sourcing_cta'
  payload             JSONB       NOT NULL DEFAULT '{}',
  related_request_id  UUID        REFERENCES v3_requests(id)  ON DELETE SET NULL,
  related_match_id    UUID        REFERENCES v3_matches(id)   ON DELETE SET NULL,
  status              TEXT        NOT NULL DEFAULT 'pending',
  -- 'pending' | 'sent' | 'replied' | 'failed'
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,
  replied_at          TIMESTAMPTZ
);

-- ── wa_contacts ─────────────────────────────────────────────────────────────
-- Persists LID→phone mappings across restarts.
-- Populated by contacts.upsert and lid-mapping.update events.
-- Used to backfill source_contact on existing records.

CREATE TABLE IF NOT EXISTS wa_contacts (
  lid        TEXT        PRIMARY KEY,   -- numeric LID, no @lid suffix
  phone      TEXT,                      -- E.164 digits, no @s.whatsapp.net suffix
  name       TEXT,                      -- pushName / notify name
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_contacts_phone ON wa_contacts(phone);

-- ── indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_v3_req_status   ON v3_requests(request_status);
CREATE INDEX IF NOT EXISTS idx_v3_req_date     ON v3_requests(ride_plan_date);
CREATE INDEX IF NOT EXISTS idx_v3_req_dest     ON v3_requests(request_destination);
CREATE INDEX IF NOT EXISTS idx_v3_req_hash     ON v3_requests(request_hash);
CREATE INDEX IF NOT EXISTS idx_v3_match_need   ON v3_matches(need_id);
CREATE INDEX IF NOT EXISTS idx_v3_match_offer  ON v3_matches(offer_id);
CREATE INDEX IF NOT EXISTS idx_v3_log_group    ON v3_message_log(source_group);
CREATE INDEX IF NOT EXISTS idx_outbound_status ON outbound_queue(status);
CREATE INDEX IF NOT EXISTS idx_outbound_contact ON outbound_queue(contact);

-- ── migrations ───────────────────────────────────────────────────────────────
-- Run these if the table already exists without these columns.

ALTER TABLE v3_requests ADD COLUMN IF NOT EXISTS sender_name TEXT;
