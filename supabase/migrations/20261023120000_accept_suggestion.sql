-- Vorschlag übernehmen: legt in einem Schritt eine Aktivität oder Unterkunft an
-- und markiert den Vorschlag als übernommen. Läuft mit den Rechten des Aufrufers,
-- RLS und guard_suggestion_decision gelten also weiter (nur Host/Travelguide).
create function public.accept_suggestion(
  p_suggestion uuid,
  p_as text,
  p_stage uuid default null,
  p_date date default null,
  p_status public.activity_status default 'planned'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  s public.suggestions;
  v_id uuid := gen_random_uuid();
begin
  select * into s from public.suggestions where id = p_suggestion for update;
  if not found then
    raise exception 'Vorschlag nicht gefunden' using errcode = 'P0002';
  end if;
  if not public.is_trip_editor(s.trip_id) then
    raise exception 'Nur Host oder Travelguide dürfen Vorschläge übernehmen' using errcode = '42501';
  end if;
  if s.status <> 'open' then
    raise exception 'Über diesen Vorschlag wurde schon entschieden' using errcode = '22023';
  end if;

  if p_as = 'stay' then
    insert into public.stays (id, trip_id, stage_id, place_id, title, link, notes, check_in)
    values (v_id, s.trip_id, p_stage, s.place_id, s.title, s.link, s.note,
            case when p_date is not null then (p_date + time '15:00') at time zone 'Europe/Berlin' end);
    update public.suggestions
      set status = 'accepted', accepted_stay_id = v_id, decided_by = auth.uid(), decided_at = now()
      where id = p_suggestion;
  elsif p_as = 'activity' then
    insert into public.activities (id, trip_id, stage_id, place_id, title, status, date, notes)
    values (v_id, s.trip_id, p_stage, s.place_id, s.title, p_status, p_date,
            concat_ws(E'\n', s.note, s.link));
    update public.suggestions
      set status = 'accepted', accepted_activity_id = v_id, decided_by = auth.uid(), decided_at = now()
      where id = p_suggestion;
  else
    raise exception 'Unbekanntes Ziel %', p_as using errcode = '22023';
  end if;

  return v_id;
end;
$$;
