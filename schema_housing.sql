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
    message_hash  TEXT UNIQUE
);
