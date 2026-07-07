-- HabitTracker initial schema for the shared Whole Life Challenge Supabase project.
-- This live project already hosts another app, so every HabitTracker object is
-- prefixed with ht_ and this migration is strictly additive and idempotent.
-- Do not add destructive statements here.

create table if not exists public.ht_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit text not null check (habit in ('vape', 'drink')),
  type text not null check (type in ('start', 'checkin', 'relapse', 'revoke')),
  event_date date,
  kind text check (kind in ('daily', 'catchup')),
  target_id uuid,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (type = 'revoke' or event_date is not null),
  check (type <> 'revoke' or event_date is null)
);

comment on table public.ht_events is
  'HabitTracker append-only event log. It is the sole source of truth; revokes are modeled as new events, not updates or deletes.';

comment on column public.ht_events.target_id is
  'Logical reference to the ht_events.id being revoked. No hard foreign key is used so the append-only log stays additive and resilient.';

create table if not exists public.ht_habit_config (
  user_id uuid not null references auth.users(id) on delete cascade,
  habit text not null check (habit in ('vape', 'drink')),
  motivational_text text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, habit)
);

comment on table public.ht_habit_config is
  'HabitTracker per-user cosmetic habit configuration. Last writer wins by updated_at.';

create index if not exists ht_events_user_habit_idx
  on public.ht_events (user_id, habit, event_date);

alter table public.ht_events enable row level security;
alter table public.ht_habit_config enable row level security;

do $$
begin
  create policy ht_events_select_own
    on public.ht_events
    for select
    using (user_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy ht_events_insert_own
    on public.ht_events
    for insert
    with check (user_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy ht_habit_config_select_own
    on public.ht_habit_config
    for select
    using (user_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy ht_habit_config_insert_own
    on public.ht_habit_config
    for insert
    with check (user_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy ht_habit_config_update_own
    on public.ht_habit_config
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy ht_habit_config_delete_own
    on public.ht_habit_config
    for delete
    using (user_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

grant select, insert on public.ht_events to authenticated;
grant select, insert, update, delete on public.ht_habit_config to authenticated;
