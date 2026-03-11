-- ============================================================
-- PILLOW — Script de setup complet des tables Supabase
-- Colle tout ça dans SQL Editor → Run
-- ============================================================

-- 1. TABLE PROFILES
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

-- Ajouter les colonnes si elles n'existent pas (idempotent)
alter table public.profiles add column if not exists pill_name        text;
alter table public.profiles add column if not exists pill_time        text;
alter table public.profiles add column if not exists boxes_remaining  integer default 1;
alter table public.profiles add column if not exists days_remaining   integer default 21;
alter table public.profiles add column if not exists stock_alert_days integer default 7;

-- RLS profiles
alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Trigger: crée un profil vide à chaque inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
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

-- 2. TABLE PILL_LOGS
create table if not exists public.pill_logs (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  date       date        not null,
  taken      boolean     not null default true,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.pill_logs enable row level security;
drop policy if exists "Users can manage own pill logs" on public.pill_logs;
create policy "Users can manage own pill logs" on public.pill_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. TABLE PUSH_SUBSCRIPTIONS
create table if not exists public.push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  endpoint   text        not null unique,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Users can manage own push subs" on public.push_subscriptions;
create policy "Users can manage own push subs" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. TABLE NOTIFICATION_SCHEDULES
create table if not exists public.notification_schedules (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  type         text        not null check (type in ('follow_up', 'snooze', 'restart', 'stock')),
  title        text        not null,
  body         text        not null,
  scheduled_at timestamptz not null,
  sent_at      timestamptz,
  created_at   timestamptz default now()
);

create index if not exists idx_notif_sched_user_sent on public.notification_schedules (user_id, sent_at);

alter table public.notification_schedules enable row level security;
drop policy if exists "Users can manage own schedules" on public.notification_schedules;
create policy "Users can manage own schedules" on public.notification_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
