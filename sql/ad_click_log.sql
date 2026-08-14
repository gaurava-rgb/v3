-- Ad click logging for sponsored banners (e.g. Poparide).
-- Logged via POST /log-ad-click (no auth gate) into this table.
-- Signed-out clicks are counted too; user_email/phone are null for them.
create table if not exists public.ad_click_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  ad          text,        -- which ad, e.g. 'poparide-tamu'
  page        text,        -- where it was shown, e.g. 'clusters-ad'
  user_email  text,        -- null for signed-out
  phone       text         -- null for signed-out
);

create index if not exists ad_click_log_ad_created_idx
  on public.ad_click_log (ad, created_at desc);
