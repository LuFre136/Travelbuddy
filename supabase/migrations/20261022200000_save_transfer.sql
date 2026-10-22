-- Transfer samt Wegpunkten in einem Schritt speichern. security invoker, damit
-- die RLS-Regeln des Aufrufers gelten (nur Host und Travelguide dürfen schreiben).
-- p_transfer: {id, trip_id, title, mode, depart_at, arrive_at, booking_ref, notes}
-- p_waypoints: [{place_id, planned_time, stop_note}, ...] in Reihenfolge
create function public.save_transfer(p_transfer jsonb, p_waypoints jsonb)
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

  insert into public.transfers (id, trip_id, title, mode, depart_at, arrive_at, booking_ref, notes)
  values (
    v_id,
    v_trip,
    nullif(p_transfer ->> 'title', ''),
    coalesce(p_transfer ->> 'mode', 'other')::public.transfer_mode,
    (p_transfer ->> 'depart_at')::timestamptz,
    (p_transfer ->> 'arrive_at')::timestamptz,
    nullif(p_transfer ->> 'booking_ref', ''),
    nullif(p_transfer ->> 'notes', '')
  )
  on conflict (id) do update set
    title = excluded.title,
    mode = excluded.mode,
    depart_at = excluded.depart_at,
    arrive_at = excluded.arrive_at,
    booking_ref = excluded.booking_ref,
    notes = excluded.notes;

  delete from public.transfer_waypoints where transfer_id = v_id;

  insert into public.transfer_waypoints (transfer_id, place_id, position, planned_time, stop_note)
  select
    v_id,
    (w.value ->> 'place_id')::uuid,
    w.ordinality::int,
    (w.value ->> 'planned_time')::timestamptz,
    nullif(w.value ->> 'stop_note', '')
  from jsonb_array_elements(coalesce(p_waypoints, '[]'::jsonb)) with ordinality as w;

  return v_id;
end;
$$;

revoke execute on function public.save_transfer(jsonb, jsonb) from anon;
