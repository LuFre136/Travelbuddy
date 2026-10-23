-- RLS- und Rollen-Tests. Jeder fehlgeschlagene Check bricht mit einer Exception ab.
\set ON_ERROR_STOP 1

create schema tests;
grant usage on schema tests to authenticated;

create function tests.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_user::text, false);
$$;

create function tests.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'FEHLER: % sollte scheitern, ging aber durch', p_label;
end;
$$;

create function tests.expect(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'FEHLER: %', p_label;
  end if;
end;
$$;

grant execute on all functions in schema tests to authenticated;

-- Testnutzer
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'host@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'guide@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'buddy@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'fremd@example.com');

select tests.expect((select count(*) from public.profiles) = 4, 'Profile werden automatisch angelegt');
select tests.expect((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'host', 'Anzeigename aus E-Mail');

-- Host legt Reise und Einladungen an
select tests.login('11111111-1111-1111-1111-111111111111');
set role authenticated;

insert into public.trips (id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Portugal 2027');
select tests.expect(public.trip_role_of('aaaaaaaa-0000-0000-0000-000000000001') = 'host', 'Ersteller wird Host');

-- insert ... returning scheitert, weil die Lese-Regel vor dem Host-Trigger greift.
-- Die App legt Reisen deshalb mit selbst erzeugter ID und ohne returning an.
select tests.expect_error($$insert into public.trips (title) values ('Mit Returning') returning id$$,
  'insert returning auf trips (App darf das nicht verwenden)');

insert into public.invites (trip_id, token, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'tok-guide', 'guide'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'tok-buddy', 'buddy');
insert into public.invites (trip_id, token, role, max_uses) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'tok-once', 'buddy', 1);
insert into public.invites (trip_id, token, role, expires_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'tok-expired', 'buddy', now() - interval '1 day');

select tests.expect_error($$insert into public.invites (trip_id, token, role) values ('aaaaaaaa-0000-0000-0000-000000000001', 'tok-host', 'host')$$,
  'Einladung mit Rolle host');
select tests.expect(length((select token from public.invites where token is not null and role = 'guide' limit 1)) > 0, 'Token vorhanden');

-- Fremde Person sieht nichts, kann aber die Einladungsvorschau lesen
reset role;
select tests.login('44444444-4444-4444-4444-444444444444');
set role authenticated;
select tests.expect((select count(*) from public.trips) = 0, 'Fremde sehen keine Reisen');
select tests.expect((select count(*) from public.invites) = 0, 'Fremde sehen keine Einladungen');
select tests.expect((select trip_title from public.invite_preview('tok-buddy')) = 'Portugal 2027', 'Einladungsvorschau');
select tests.expect((select valid from public.invite_preview('tok-expired')) = false, 'Abgelaufene Einladung in Vorschau ungültig');
select tests.expect_error($$select public.accept_invite('tok-expired')$$, 'Abgelaufene Einladung einlösen');
select tests.expect_error($$select public.accept_invite('gibt-es-nicht')$$, 'Unbekannte Einladung einlösen');
select tests.expect_error($$insert into public.activities (trip_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Hack')$$,
  'Fremde legen Aktivität an');
select public.accept_invite('tok-once');
select tests.expect(public.trip_role_of('aaaaaaaa-0000-0000-0000-000000000001') = 'buddy', 'Einmal-Einladung eingelöst');

-- Guide und Buddy treten bei
reset role;
select tests.login('22222222-2222-2222-2222-222222222222');
set role authenticated;
select tests.expect(public.accept_invite('tok-guide') = 'aaaaaaaa-0000-0000-0000-000000000001', 'Guide tritt bei');
select tests.expect(public.trip_role_of('aaaaaaaa-0000-0000-0000-000000000001') = 'guide', 'Guide hat Rolle guide');

reset role;
select tests.login('33333333-3333-3333-3333-333333333333');
set role authenticated;
select tests.expect_error($$select public.accept_invite('tok-once')$$, 'Einmal-Einladung zweites Mal');
select public.accept_invite('tok-buddy');
select tests.expect(public.trip_role_of('aaaaaaaa-0000-0000-0000-000000000001') = 'buddy', 'Buddy hat Rolle buddy');
select tests.expect((select count(*) from public.profiles) = 4, 'Mitreisende sehen sich gegenseitig');

-- Buddy: nur Vorschläge, kein Bearbeiten des Plans
select tests.expect_error($$insert into public.activities (trip_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Surfen')$$,
  'Buddy legt Aktivität an');
select tests.expect_error($$insert into public.stays (trip_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Hostel')$$,
  'Buddy legt Unterkunft an');
select tests.expect_error($$insert into public.invites (trip_id, token) values ('aaaaaaaa-0000-0000-0000-000000000001', 'tok-b')$$,
  'Buddy erstellt Einladung');
update public.trips set title = 'Gekapert' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.trip_members set role = 'guide' where user_id = '33333333-3333-3333-3333-333333333333';
select tests.expect(public.trip_role_of('aaaaaaaa-0000-0000-0000-000000000001') = 'buddy', 'Buddy kann sich nicht hochstufen');

insert into public.places (id, trip_id, name, lat, lng)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Time Out Market', 38.707, -9.146);
insert into public.suggestions (id, trip_id, place_id, kind, title)
  values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
          'bbbbbbbb-0000-0000-0000-000000000001', 'food', 'Time Out Market');
insert into public.suggestion_votes (suggestion_id, value) values ('cccccccc-0000-0000-0000-000000000001', 1);
select tests.expect_error($$insert into public.suggestion_votes (suggestion_id, value) values ('cccccccc-0000-0000-0000-000000000001', 1)$$,
  'Doppelte Stimme');
select tests.expect_error($$insert into public.suggestion_votes (suggestion_id, user_id, value) values ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1)$$,
  'Stimme für andere abgeben');
update public.suggestions set note = 'Unbedingt hin' where id = 'cccccccc-0000-0000-0000-000000000001';
select tests.expect((select note from public.suggestions where id = 'cccccccc-0000-0000-0000-000000000001') = 'Unbedingt hin', 'Buddy bearbeitet eigenen Vorschlag');
select tests.expect_error($$update public.suggestions set status = 'accepted' where id = 'cccccccc-0000-0000-0000-000000000001'$$,
  'Buddy übernimmt Vorschlag');

-- Guide übernimmt den Vorschlag
reset role;
select tests.login('22222222-2222-2222-2222-222222222222');
set role authenticated;
insert into public.suggestion_votes (suggestion_id, value) values ('cccccccc-0000-0000-0000-000000000001', -1);
select tests.expect((select score from public.suggestion_scores where suggestion_id = 'cccccccc-0000-0000-0000-000000000001') = 0, 'Score 1 + (-1)');
select tests.expect((select likes from public.suggestion_scores where suggestion_id = 'cccccccc-0000-0000-0000-000000000001') = 1, 'Likes zählen');
insert into public.activities (id, trip_id, place_id, title, status)
  values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
          'bbbbbbbb-0000-0000-0000-000000000001', 'Time Out Market', 'planned');
update public.suggestions
  set status = 'accepted', accepted_activity_id = 'dddddddd-0000-0000-0000-000000000001',
      decided_by = auth.uid(), decided_at = now()
  where id = 'cccccccc-0000-0000-0000-000000000001';
select tests.expect((select status from public.suggestions where id = 'cccccccc-0000-0000-0000-000000000001') = 'accepted', 'Guide übernimmt Vorschlag');

insert into public.transfers (id, trip_id, mode) values ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'train');
insert into public.transfer_waypoints (transfer_id, place_id, position)
  values ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 1);
select tests.expect_error($$insert into public.invites (trip_id, token, role) values ('aaaaaaaa-0000-0000-0000-000000000001', 'tok-g2', 'guide')$$,
  'Guide lädt weiteren Guide ein');
insert into public.invites (trip_id, token, role) values ('aaaaaaaa-0000-0000-0000-000000000001', 'tok-g-buddy', 'buddy');
select tests.expect_error($$select public.transfer_host('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222')$$,
  'Guide macht sich selbst zum Host');
delete from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Buddy sieht die Wegpunkte, darf sie aber nicht ändern
reset role;
select tests.login('33333333-3333-3333-3333-333333333333');
set role authenticated;
select tests.expect((select count(*) from public.transfer_waypoints) = 1, 'Buddy sieht Wegpunkte');
select tests.expect_error($$insert into public.transfer_waypoints (transfer_id, place_id, position) values ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 2)$$,
  'Buddy legt Wegpunkt an');

-- Host überträgt die Host-Rolle
reset role;
select tests.login('11111111-1111-1111-1111-111111111111');
set role authenticated;
select tests.expect((select title from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Portugal 2027', 'Buddy/Guide konnten Reise weder ändern noch löschen');
delete from public.trip_members where user_id = '11111111-1111-1111-1111-111111111111';
select tests.expect(public.trip_role_of('aaaaaaaa-0000-0000-0000-000000000001') = 'host', 'Host kann Reise nicht ohne Übergabe verlassen');
select public.transfer_host('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
select tests.expect(public.trip_role_of('aaaaaaaa-0000-0000-0000-000000000001') = 'guide', 'Alter Host wird Guide');
reset role;
select tests.expect((select role from public.trip_members where user_id = '22222222-2222-2222-2222-222222222222') = 'host', 'Neuer Host');

-- save_transfer: Guide speichert Transfer mit Wegpunkten atomar, Buddy darf es nicht
reset role;
insert into public.places (id, trip_id, name, created_by) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Lissabon Santa Apolónia', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Porto Campanhã', '11111111-1111-1111-1111-111111111111');

select tests.login('11111111-1111-1111-1111-111111111111');
set role authenticated;
select tests.expect(
  public.save_transfer(
    '{"id": "eeeeeeee-0000-0000-0000-000000000002", "trip_id": "aaaaaaaa-0000-0000-0000-000000000001", "mode": "train", "title": "Alfa Pendular"}',
    '[{"place_id": "bbbbbbbb-0000-0000-0000-000000000002"}, {"place_id": "bbbbbbbb-0000-0000-0000-000000000001"}, {"place_id": "bbbbbbbb-0000-0000-0000-000000000003"}]'
  ) = 'eeeeeeee-0000-0000-0000-000000000002', 'save_transfer legt an');
select tests.expect((select count(*) from public.transfer_waypoints where transfer_id = 'eeeeeeee-0000-0000-0000-000000000002') = 3, 'Drei Wegpunkte');

-- Reihenfolge ändern und einen Wegpunkt entfernen
select public.save_transfer(
  '{"id": "eeeeeeee-0000-0000-0000-000000000002", "trip_id": "aaaaaaaa-0000-0000-0000-000000000001", "mode": "bus", "title": "Rede Expressos"}',
  '[{"place_id": "bbbbbbbb-0000-0000-0000-000000000003"}, {"place_id": "bbbbbbbb-0000-0000-0000-000000000002"}]'
);
select tests.expect((select mode from public.transfers where id = 'eeeeeeee-0000-0000-0000-000000000002') = 'bus', 'Transfer aktualisiert');

-- Datum, optionale Uhrzeit und Verkehrsmittel pro Abschnitt
select public.save_transfer(
  '{"id": "eeeeeeee-0000-0000-0000-000000000003", "trip_id": "aaaaaaaa-0000-0000-0000-000000000001", "mode": "train"}',
  '[{"place_id": "bbbbbbbb-0000-0000-0000-000000000002", "day": "2027-05-03", "time": "11:30", "segment_mode": "car"},
    {"place_id": "bbbbbbbb-0000-0000-0000-000000000003", "day": "2027-05-03", "segment_mode": "bus"}]'
);
select tests.expect(
  (select array_agg(coalesce(segment_mode::text, '-') || '/' || coalesce(time::text, '-') order by position)
   from public.transfer_waypoints where transfer_id = 'eeeeeeee-0000-0000-0000-000000000003')
  = array['-/11:30:00', 'bus/-'],
  'Erster Wegpunkt ohne Abschnitt, zweiter mit Bus und ohne Uhrzeit');
select tests.expect(
  (select array_agg(place_id order by position) from public.transfer_waypoints where transfer_id = 'eeeeeeee-0000-0000-0000-000000000002')
  = array['bbbbbbbb-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002']::uuid[],
  'Neue Reihenfolge');

reset role;
select tests.login('33333333-3333-3333-3333-333333333333');
set role authenticated;
select tests.expect_error($$select public.save_transfer('{"trip_id": "aaaaaaaa-0000-0000-0000-000000000001", "mode": "car"}', '[]')$$,
  'Buddy legt per save_transfer an');
select tests.expect_error($$select public.save_transfer('{"id": "eeeeeeee-0000-0000-0000-000000000002", "trip_id": "aaaaaaaa-0000-0000-0000-000000000001", "mode": "car"}', '[]')$$,
  'Buddy ändert per save_transfer');
reset role;
select tests.expect((select count(*) from public.transfer_waypoints where transfer_id = 'eeeeeeee-0000-0000-0000-000000000002') = 2, 'Buddy hat Wegpunkte nicht gelöscht');
