-- Etappen: benannte Tagesbereiche einer Reise (z. B. Tag 1–3 Palma, Tag 4–6 Alcudia).
-- Unterkünfte, Transfers und Aktivitäten können einer Etappe zugeordnet werden.
create table public.stages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  color text not null default '#0e6b58' check (color ~ '^#[0-9a-f]{6}$'),
  start_day date,
  end_day date,
  created_at timestamptz not null default now(),
  check (end_day is null or start_day is null or end_day >= start_day),
  -- Ziel der zusammengesetzten Fremdschlüssel unten: Etappe muss zur selben Reise gehören.
  unique (trip_id, id)
);

create index stages_trip on public.stages (trip_id, start_day);

alter table public.stages enable row level security;
create policy stages_select on public.stages for select to authenticated using (public.is_trip_member(trip_id));
create policy stages_write on public.stages for all to authenticated
  using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));

alter table public.stays add column stage_id uuid;
alter table public.stays add constraint stays_stage_fk foreign key (trip_id, stage_id)
  references public.stages (trip_id, id) on delete set null (stage_id);
alter table public.transfers add column stage_id uuid;
alter table public.transfers add constraint transfers_stage_fk foreign key (trip_id, stage_id)
  references public.stages (trip_id, id) on delete set null (stage_id);
alter table public.activities add column stage_id uuid;
alter table public.activities add constraint activities_stage_fk foreign key (trip_id, stage_id)
  references public.stages (trip_id, id) on delete set null (stage_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.stages;
  end if;
end;
$$;

-- save_transfer übernimmt zusätzlich stage_id.
-- p_waypoints: [{place_id, day, time, segment_mode, stop_note}, ...] in Reihenfolge
create or replace function public.save_transfer(p_transfer jsonb, p_waypoints jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := coalesce((p_transfer ->> 'id')::uuid, gen_random_uuid());
  v_trip uuid := (p_transfer ->> 'trip_id')::uuid;
begin
  if exists (select 1 from public.transfers where id = v_id and trip_id <> v_trip) then
    raise exception 'Transfer gehört zu einer anderen Reise' using errcode = '42501';
  end if;

  insert into public.transfers (id, trip_id, stage_id, title, mode, depart_at, arrive_at, booking_ref, notes)
  values (
    v_id,
    v_trip,
    (p_transfer ->> 'stage_id')::uuid,
    nullif(p_transfer ->> 'title', ''),
    coalesce(p_transfer ->> 'mode', 'other')::public.transfer_mode,
    (p_transfer ->> 'depart_at')::timestamptz,
    (p_transfer ->> 'arrive_at')::timestamptz,
    nullif(p_transfer ->> 'booking_ref', ''),
    nullif(p_transfer ->> 'notes', '')
  )
  on conflict (id) do update set
    stage_id = excluded.stage_id,
    title = excluded.title,
    mode = excluded.mode,
    depart_at = excluded.depart_at,
    arrive_at = excluded.arrive_at,
    booking_ref = excluded.booking_ref,
    notes = excluded.notes;

  delete from public.transfer_waypoints where transfer_id = v_id;

  insert into public.transfer_waypoints (transfer_id, place_id, position, day, time, segment_mode, stop_note)
  select
    v_id,
    (w.value ->> 'place_id')::uuid,
    w.ordinality::int,
    (w.value ->> 'day')::date,
    (w.value ->> 'time')::time,
    case when w.ordinality > 1 then (w.value ->> 'segment_mode')::public.transfer_mode end,
    nullif(w.value ->> 'stop_note', '')
  from jsonb_array_elements(coalesce(p_waypoints, '[]'::jsonb)) with ordinality as w;

  return v_id;
end;
$$;
