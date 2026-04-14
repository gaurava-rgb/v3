-- Sprint 9: Housing Board
-- Run this in the Supabase SQL editor before deploying.

CREATE TABLE IF NOT EXISTS v3_housing (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug          TEXT UNIQUE NOT NULL,
    source_contact TEXT,
    sender_name   TEXT,
    message_text  TEXT NOT NULL,
    listing_type  TEXT,                       -- 'sublease' | 'roommate' | 'lease_transfer' | 'other'
    location      TEXT,
    price         INTEGER,                    -- monthly rent in dollars, null if not mentioned
    available_date DATE,
    end_date      DATE,
    bedrooms      INTEGER,
    bathrooms     NUMERIC(3,1),
    amenities     TEXT[],
    contact_phone TEXT,
    contact_info  TEXT,
    active        BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    sent_at       TIMESTAMPTZ,                 -- original WhatsApp message timestamp (for freshness calculation)
    message_hash  TEXT UNIQUE,
    poster_phone  TEXT                         -- cached from wa_contacts; avoids second query on detail page
);

-- Index for fast slug lookups (detail page)
CREATE INDEX IF NOT EXISTS idx_v3_housing_slug ON v3_housing(slug);

-- Index for wa_contacts lid lookups (poster phone resolution)
CREATE INDEX IF NOT EXISTS idx_wa_contacts_lid ON wa_contacts(lid);

-- Migration: add poster_phone column if table already exists
ALTER TABLE v3_housing ADD COLUMN IF NOT EXISTS poster_phone TEXT;

-- Migration: add sent_at column for accurate freshness calculation
ALTER TABLE v3_housing ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
