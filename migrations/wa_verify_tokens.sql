create table if not exists wa_verify_tokens (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  email text not null,
  phone text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists idx_wa_verify_tokens_token on wa_verify_tokens(token);
create index if not exists idx_wa_verify_tokens_email on wa_verify_tokens(email);
