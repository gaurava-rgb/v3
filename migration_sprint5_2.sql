-- Sprint 5.2: Auth Ladder tables
-- Run in Supabase SQL Editor

-- Users (email + optional phone verification)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  phone_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contact reveal audit log
CREATE TABLE IF NOT EXISTS contact_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_user_id UUID REFERENCES users(id),
  viewed_contact TEXT,
  cluster_key TEXT,
  viewed_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index for contact view auditing
CREATE INDEX IF NOT EXISTS idx_contact_views_viewer ON contact_views(viewer_user_id);
