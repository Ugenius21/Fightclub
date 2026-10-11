-- Fightclub: Tabelle für die Synchronisierung.
-- Einmal im Supabase-Dashboard unter "SQL Editor" ausführen.
-- Jeder Benutzer hat genau eine Zeile mit seinen Daten (JSON).

create table if not exists public.fightclub_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.fightclub_data enable row level security;

-- Jeder darf nur seine eigene Zeile lesen und schreiben.
drop policy if exists "fightclub select own" on public.fightclub_data;
drop policy if exists "fightclub insert own" on public.fightclub_data;
drop policy if exists "fightclub update own" on public.fightclub_data;

create policy "fightclub select own" on public.fightclub_data
  for select using (auth.uid() = user_id);

create policy "fightclub insert own" on public.fightclub_data
  for insert with check (auth.uid() = user_id);

create policy "fightclub update own" on public.fightclub_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
