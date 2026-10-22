-- ============================================================
-- PILLOW — Setup complet de la base Supabase (idempotent)
-- Supabase Dashboard → SQL Editor → colle tout → Run
-- Tu peux le relancer sans risque : rien n'est supprimé.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid        primary key references auth.users (id) on delete cascade,
  name              text,
  pill_name         text,
  pill_time         text,
  boxes_remaining   integer     default 1,
  days_remaining    integer     default 21,
  stock_alert_days  integer     default 7,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table public.profiles add column if not exists pill_name        text;
alter table public.profiles add column if not exists pill_time        text;
alter table public.profiles add column if not exists boxes_remaining  integer default 1;
alter table public.profiles add column if not exists days_remaining   integer default 21;
alter table public.profiles add column if not exists stock_alert_days integer default 7;
-- Nouveautés v2
alter table public.profiles add column if not exists timezone          text    not null default 'Europe/Paris';
alter table public.profiles add column if not exists pack_start_date   date;
alter table public.profiles add column if not exists notif_reminder    boolean not null default true;
alter table public.profiles add column if not exists notif_nag         boolean not null default true;
alter table public.profiles add column if not exists notif_stock       boolean not null default true;
alter table public.profiles add column if not exists notif_restart     boolean not null default true;

alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile"   on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Crée un profil vide à chaque inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- 2. PILL_LOGS (une ligne par jour et par utilisatrice)
-- ------------------------------------------------------------
create table if not exists public.pill_logs (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  date       date        not null,
  taken      boolean     not null default true,
  created_at timestamptz default now(),
  unique (user_id, date)
);

alter table public.pill_logs add column if not exists taken_at timestamptz;

create index if not exists idx_pill_logs_user_date on public.pill_logs (user_id, date desc);

alter table public.pill_logs enable row level security;
drop policy if exists "Users can manage own pill logs" on public.pill_logs;
create policy "Users can manage own pill logs" on public.pill_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. PUSH_SUBSCRIPTIONS (un appareil = une ligne)
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  endpoint   text        not null unique,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_push_subs_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Users can manage own push subs" on public.push_subscriptions;
create policy "Users can manage own push subs" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4. NOTIFICATION_SCHEDULES (rappels ponctuels : « plus tard », etc.)
-- ------------------------------------------------------------
create table if not exists public.notification_schedules (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  type         text        not null,
  title        text        not null,
  body         text        not null,
  scheduled_at timestamptz not null,
  sent_at      timestamptz,
  created_at   timestamptz default now()
);

alter table public.notification_schedules drop constraint if exists notification_schedules_type_check;
alter table public.notification_schedules
  add constraint notification_schedules_type_check
  check (type in ('snooze', 'follow_up', 'restart', 'stock', 'reminder', 'nag'));

create index if not exists idx_notif_sched_user_sent on public.notification_schedules (user_id, sent_at);
create index if not exists idx_notif_sched_due on public.notification_schedules (scheduled_at) where sent_at is null;

alter table public.notification_schedules enable row level security;
drop policy if exists "Users can manage own schedules" on public.notification_schedules;
create policy "Users can manage own schedules" on public.notification_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5. NOTIFICATION_STATE (état interne du serveur d'envoi)
--    RLS activée SANS policy : seule la clé service_role y accède.
-- ------------------------------------------------------------
create table if not exists public.notification_state (
  user_id        uuid        primary key references auth.users (id) on delete cascade,
  reminder_key   text,
  nag_count      integer     not null default 0,
  last_sent_at   timestamptz,
  stock_date     date,
  restart_date   date,
  updated_at     timestamptz default now()
);

alter table public.notification_state enable row level security;

-- ------------------------------------------------------------
-- 6. REALTIME (synchro instantanée entre appareils)
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.pill_logs;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.profiles;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
