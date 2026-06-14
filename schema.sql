-- ============================================================
-- GEMBA Walk — nastavenie databázy Supabase
-- Spusti CELÝ tento súbor v: Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1) Tabuľka inšpekcií ----------------------------------------
create table if not exists public.inspections (
  id                  uuid primary key default gen_random_uuid(),
  gemba_topic         text not null,
  site                text not null,
  issue_found         text,
  possible_root_cause text,
  next_step           text,
  assigned_to         text,
  reported_by         text,
  status              text not null default 'Nový',
  priority            text not null default 'Stredná',
  photos              jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists inspections_created_at_idx
  on public.inspections (created_at desc);

-- 2) Automatický updated_at -----------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_set_updated_at on public.inspections;
create trigger trg_set_updated_at
  before update on public.inspections
  for each row execute function public.set_updated_at();

-- 3) Row Level Security (tímový prístup) ----------------------
-- Každý PRIHLÁSENÝ používateľ vidí a upravuje všetky záznamy tímu.
alter table public.inspections enable row level security;

drop policy if exists "team_select" on public.inspections;
drop policy if exists "team_insert" on public.inspections;
drop policy if exists "team_update" on public.inspections;
drop policy if exists "team_delete" on public.inspections;

create policy "team_select" on public.inspections
  for select to authenticated using (true);
create policy "team_insert" on public.inspections
  for insert to authenticated with check (true);
create policy "team_update" on public.inspections
  for update to authenticated using (true) with check (true);
create policy "team_delete" on public.inspections
  for delete to authenticated using (true);

-- 4) Úložisko fotiek ------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "photos_read"   on storage.objects;
drop policy if exists "photos_insert" on storage.objects;
drop policy if exists "photos_delete" on storage.objects;

create policy "photos_read" on storage.objects
  for select using (bucket_id = 'photos');
create policy "photos_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');
create policy "photos_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');

-- 5) (Voliteľné) živé aktualizácie ----------------------------
-- Zapne realtime, aby sa zoznam obnovil keď pridá kolega.
alter publication supabase_realtime add table public.inspections;

-- Hotovo. Môžeš zavrieť SQL Editor.
