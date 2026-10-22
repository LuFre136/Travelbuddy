-- Travelbuddy: Grundschema mit Rollen und Row Level Security.
-- Jede fachliche Tabelle hängt an einer Reise (trip). Zugriff wird über
-- trip_members geprüft. Rollen: host (Ersteller), guide (Travelguide/Admin),
-- buddy (Mitreisende, dürfen nur Vorschläge machen und abstimmen).

-- ---------------------------------------------------------------------------
-- Typen
-- ---------------------------------------------------------------------------
create type public.trip_role as enum ('host', 'guide', 'buddy');
create type public.transfer_mode as enum ('car', 'train', 'bus', 'flight', 'ferry', 'walk', 'bike', 'other');
create type public.activity_status as enum ('optional', 'planned');
create type public.suggestion_kind as enum ('stay', 'activity', 'food', 'drinks', 'place');
create type public.suggestion_status as enum ('open', 'accepted', 'rejected');
create type public.place_source as enum ('manual', 'search', 'import');
create type public.import_source as enum ('takeout_csv', 'links', 'kml');
create type public.import_status as enum ('pending', 'processing', 'done', 'failed');

-- ---------------------------------------------------------------------------
-- Profile
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Reisen und Mitglieder
-- ---------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text,
  start_date date,
  end_date date,
  cover_image text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.trip_role not null default 'buddy',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- Genau ein Host pro Reise.
create unique index trip_members_one_host on public.trip_members (trip_id) where role = 'host';
create index trip_members_user on public.trip_members (user_id);

-- Hilfsfunktionen für RLS. security definer, damit die Policies von
-- trip_members sich nicht selbst rekursiv aufrufen.
create function public.trip_role_of(p_trip uuid)
returns public.trip_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.trip_members
  where trip_id = p_trip and user_id = auth.uid()
$$;

create function public.is_trip_member(p_trip uuid)
returns boolean
language sql
stable
as $$ select public.trip_role_of(p_trip) is not null $$;

create function public.is_trip_editor(p_trip uuid)
returns boolean
language sql
stable
as $$ select coalesce(public.trip_role_of(p_trip) in ('host', 'guide'), false) $$;

create function public.is_trip_host(p_trip uuid)
returns boolean
language sql
stable
as $$ select coalesce(public.trip_role_of(p_trip) = 'host', false) $$;

-- Ersteller wird automatisch Host.
create function public.handle_new_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.created_by, 'host');
  return new;
end;
$$;

create trigger on_trip_created
  after insert on public.trips
  for each row execute function public.handle_new_trip();

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trips_touch before update on public.trips
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Einladungen
-- ---------------------------------------------------------------------------
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  role public.trip_role not null default 'buddy' check (role <> 'host'),
  expires_at timestamptz default now() + interval '14 days',
  max_uses int check (max_uses is null or max_uses > 0),
  use_count int not null default 0,
  revoked boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index invites_trip on public.invites (trip_id);

-- ---------------------------------------------------------------------------
-- Orte (gemeinsame Basis für Karte, Unterkünfte, Wegpunkte, Vorschläge)
-- ---------------------------------------------------------------------------
create table public.places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  address text,
  category text,
  external_url text,
  google_place_ref text,
  source public.place_source not null default 'manual',
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index places_trip on public.places (trip_id);

-- ---------------------------------------------------------------------------
-- Reiseplan
-- ---------------------------------------------------------------------------
create table public.stays (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_id uuid references public.places (id) on delete set null,
  title text not null,
  check_in timestamptz,
  check_out timestamptz,
  booking_ref text,
  link text,
  cost numeric(12, 2),
  currency char(3),
  notes text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  check (check_out is null or check_in is null or check_out >= check_in)
);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text,
  mode public.transfer_mode not null default 'other',
  depart_at timestamptz,
  arrive_at timestamptz,
  booking_ref text,
  notes text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.transfer_waypoints (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.transfers (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  position int not null,
  planned_time timestamptz,
  stop_note text,
  unique (transfer_id, position) deferrable initially deferred
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_id uuid references public.places (id) on delete set null,
  title text not null,
  status public.activity_status not null default 'optional',
  date date,
  start_time time,
  end_time time,
  cost numeric(12, 2),
  currency char(3),
  notes text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index stays_trip on public.stays (trip_id);
create index transfers_trip on public.transfers (trip_id);
create index activities_trip on public.activities (trip_id);

-- ---------------------------------------------------------------------------
-- Vorschläge und Abstimmung
-- ---------------------------------------------------------------------------
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  source public.import_source not null,
  file_name text,
  status public.import_status not null default 'pending',
  rows_total int not null default 0,
  rows_ok int not null default 0,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_id uuid references public.places (id) on delete set null,
  kind public.suggestion_kind not null,
  title text not null,
  note text,
  link text,
  status public.suggestion_status not null default 'open',
  accepted_activity_id uuid references public.activities (id) on delete set null,
  accepted_stay_id uuid references public.stays (id) on delete set null,
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  import_id uuid references public.imports (id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index suggestions_trip on public.suggestions (trip_id);

create table public.suggestion_votes (
  suggestion_id uuid not null references public.suggestions (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);

-- Nur Host und Travelguide dürfen über einen Vorschlag entscheiden.
create function public.guard_suggestion_decision()
returns trigger
language plpgsql
as $$
begin
  if (new.status, new.accepted_activity_id, new.accepted_stay_id, new.decided_by, new.decided_at)
     is distinct from
     (old.status, old.accepted_activity_id, old.accepted_stay_id, old.decided_by, old.decided_at)
     and not public.is_trip_editor(new.trip_id) then
    raise exception 'Nur Host oder Travelguide dürfen Vorschläge übernehmen oder ablehnen'
      using errcode = '42501';
  end if;
  if new.trip_id <> old.trip_id then
    raise exception 'Ein Vorschlag kann nicht in eine andere Reise verschoben werden'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger suggestions_guard before update on public.suggestions
  for each row execute function public.guard_suggestion_decision();

create view public.suggestion_scores
with (security_invoker = true)
as
select
  s.id as suggestion_id,
  count(v.*) filter (where v.value = 1) as likes,
  count(v.*) filter (where v.value = -1) as dislikes,
  coalesce(sum(v.value), 0) as score
from public.suggestions s
left join public.suggestion_votes v on v.suggestion_id = s.id
group by s.id;

-- ---------------------------------------------------------------------------
-- Funktionen für Einladungen und Host-Wechsel
-- ---------------------------------------------------------------------------
create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invites;
begin
  if auth.uid() is null then
    raise exception 'Bitte zuerst anmelden' using errcode = '28000';
  end if;

  select * into v_invite from public.invites where token = p_token for update;

  if not found or v_invite.revoked
     or (v_invite.expires_at is not null and v_invite.expires_at < now())
     or (v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses) then
    raise exception 'Einladung ist ungültig oder abgelaufen' using errcode = 'P0002';
  end if;

  -- Wer schon Mitglied ist, behält seine Rolle und verbraucht keine Nutzung.
  insert into public.trip_members (trip_id, user_id, role)
  values (v_invite.trip_id, auth.uid(), v_invite.role)
  on conflict (trip_id, user_id) do nothing;

  if found then
    update public.invites set use_count = use_count + 1 where id = v_invite.id;
  end if;

  return v_invite.trip_id;
end;
$$;

-- Vorschau für die Beitrittsseite, ohne Mitglied zu sein.
create function public.invite_preview(p_token text)
returns table (trip_id uuid, trip_title text, role public.trip_role, valid boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title, i.role,
    not i.revoked
      and (i.expires_at is null or i.expires_at >= now())
      and (i.max_uses is null or i.use_count < i.max_uses)
  from public.invites i
  join public.trips t on t.id = i.trip_id
  where i.token = p_token
$$;

create function public.transfer_host(p_trip uuid, p_new_host uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_trip_host(p_trip) then
    raise exception 'Nur der Host kann die Host-Rolle übertragen' using errcode = '42501';
  end if;
  if not exists (select 1 from public.trip_members where trip_id = p_trip and user_id = p_new_host) then
    raise exception 'Die Person ist kein Mitglied dieser Reise' using errcode = 'P0002';
  end if;
  if p_new_host = auth.uid() then
    return;
  end if;

  update public.trip_members set role = 'guide' where trip_id = p_trip and user_id = auth.uid();
  update public.trip_members set role = 'host' where trip_id = p_trip and user_id = p_new_host;
end;
$$;

revoke execute on function public.accept_invite(text) from anon;
revoke execute on function public.transfer_host(uuid, uuid) from anon;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.invites enable row level security;
alter table public.places enable row level security;
alter table public.stays enable row level security;
alter table public.transfers enable row level security;
alter table public.transfer_waypoints enable row level security;
alter table public.activities enable row level security;
alter table public.imports enable row level security;
alter table public.suggestions enable row level security;
alter table public.suggestion_votes enable row level security;

-- Profile: sich selbst und Mitreisende sehen, nur sich selbst ändern.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.trip_members mine
      join public.trip_members theirs on theirs.trip_id = mine.trip_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Reisen
create policy trips_select on public.trips for select to authenticated
  using (public.is_trip_member(id));
create policy trips_insert on public.trips for insert to authenticated
  with check (created_by = auth.uid());
create policy trips_update on public.trips for update to authenticated
  using (public.is_trip_host(id)) with check (public.is_trip_host(id));
create policy trips_delete on public.trips for delete to authenticated
  using (public.is_trip_host(id));

-- Mitglieder: Einfügen nur über Trigger/accept_invite. Host vergibt Rollen
-- (außer host, dafür gibt es transfer_host) und entfernt Mitglieder.
-- Jeder außer dem Host kann die Reise selbst verlassen.
create policy members_select on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id));
create policy members_update on public.trip_members for update to authenticated
  using (public.is_trip_host(trip_id) and role <> 'host')
  with check (public.is_trip_host(trip_id) and role <> 'host');
create policy members_delete on public.trip_members for delete to authenticated
  using (role <> 'host' and (public.is_trip_host(trip_id) or user_id = auth.uid()));

-- Einladungen: Host lädt mit jeder Rolle ein, Travelguides nur Buddies.
create policy invites_select on public.invites for select to authenticated
  using (public.is_trip_editor(trip_id));
create policy invites_insert on public.invites for insert to authenticated
  with check (
    created_by = auth.uid()
    and (public.is_trip_host(trip_id) or (public.is_trip_editor(trip_id) and role = 'buddy'))
  );
create policy invites_update on public.invites for update to authenticated
  using (public.is_trip_host(trip_id) or created_by = auth.uid())
  with check (public.is_trip_host(trip_id) or (public.is_trip_editor(trip_id) and role = 'buddy'));
create policy invites_delete on public.invites for delete to authenticated
  using (public.is_trip_host(trip_id) or created_by = auth.uid());

-- Orte: alle Mitglieder dürfen Orte anlegen (für Vorschläge),
-- ändern dürfen Admins oder wer den Ort angelegt hat.
create policy places_select on public.places for select to authenticated
  using (public.is_trip_member(trip_id));
create policy places_insert on public.places for insert to authenticated
  with check (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy places_update on public.places for update to authenticated
  using (public.is_trip_editor(trip_id) or created_by = auth.uid())
  with check (public.is_trip_member(trip_id));
create policy places_delete on public.places for delete to authenticated
  using (public.is_trip_editor(trip_id) or created_by = auth.uid());

-- Reiseplan: lesen alle Mitglieder, schreiben nur Host und Travelguide.
create policy stays_select on public.stays for select to authenticated using (public.is_trip_member(trip_id));
create policy stays_write on public.stays for all to authenticated
  using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));

create policy transfers_select on public.transfers for select to authenticated using (public.is_trip_member(trip_id));
create policy transfers_write on public.transfers for all to authenticated
  using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));

create policy waypoints_select on public.transfer_waypoints for select to authenticated
  using (exists (select 1 from public.transfers t where t.id = transfer_id and public.is_trip_member(t.trip_id)));
create policy waypoints_write on public.transfer_waypoints for all to authenticated
  using (exists (select 1 from public.transfers t where t.id = transfer_id and public.is_trip_editor(t.trip_id)))
  with check (exists (select 1 from public.transfers t where t.id = transfer_id and public.is_trip_editor(t.trip_id)));

create policy activities_select on public.activities for select to authenticated using (public.is_trip_member(trip_id));
create policy activities_write on public.activities for all to authenticated
  using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));

-- Importe erzeugen Vorschläge, daher darf jedes Mitglied importieren.
create policy imports_select on public.imports for select to authenticated using (public.is_trip_member(trip_id));
create policy imports_insert on public.imports for insert to authenticated
  with check (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy imports_update on public.imports for update to authenticated
  using (created_by = auth.uid() or public.is_trip_editor(trip_id))
  with check (public.is_trip_member(trip_id));

-- Vorschläge: jedes Mitglied reicht ein und bearbeitet eigene offene Vorschläge.
-- Status ändern nur Admins (Trigger guard_suggestion_decision).
create policy suggestions_select on public.suggestions for select to authenticated
  using (public.is_trip_member(trip_id));
create policy suggestions_insert on public.suggestions for insert to authenticated
  with check (public.is_trip_member(trip_id) and created_by = auth.uid() and status = 'open');
create policy suggestions_update on public.suggestions for update to authenticated
  using (public.is_trip_editor(trip_id) or (created_by = auth.uid() and status = 'open'))
  with check (public.is_trip_member(trip_id));
create policy suggestions_delete on public.suggestions for delete to authenticated
  using (public.is_trip_editor(trip_id) or (created_by = auth.uid() and status = 'open'));

-- Votes: jedes Mitglied genau eine Stimme pro Vorschlag, nur die eigene.
create policy votes_select on public.suggestion_votes for select to authenticated
  using (exists (select 1 from public.suggestions s where s.id = suggestion_id and public.is_trip_member(s.trip_id)));
create policy votes_insert on public.suggestion_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.suggestions s where s.id = suggestion_id and public.is_trip_member(s.trip_id))
  );
create policy votes_update on public.suggestion_votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy votes_delete on public.suggestion_votes for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime für Live-Updates
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.trips, public.trip_members, public.places, public.stays, public.transfers,
      public.transfer_waypoints, public.activities, public.suggestions, public.suggestion_votes;
  end if;
end;
$$;
