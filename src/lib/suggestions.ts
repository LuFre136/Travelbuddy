import { ensurePlace, type ActivityStatus, type Place } from './plan'
import type { PlaceInput } from './places'
import { requireSupabase } from './supabase'

export type SuggestionKind = 'stay' | 'activity' | 'food' | 'drinks' | 'place'
export type SuggestionStatus = 'open' | 'accepted' | 'rejected'

export const suggestionKindLabels: Record<SuggestionKind, string> = {
  activity: 'Aktivität',
  food: 'Essen',
  drinks: 'Drinks',
  place: 'Ort',
  stay: 'Unterkunft',
}

export const suggestionStatusLabels: Record<SuggestionStatus, string> = {
  open: 'Offen',
  accepted: 'Übernommen',
  rejected: 'Abgelehnt',
}

export interface Vote {
  user_id: string
  value: 1 | -1
}

export interface Suggestion {
  id: string
  trip_id: string
  kind: SuggestionKind
  title: string
  note: string | null
  link: string | null
  status: SuggestionStatus
  created_by: string
  created_at: string
  place: Place | null
  votes: Vote[]
}

export interface VoteSummary {
  likes: number
  dislikes: number
  score: number
  mine: 1 | -1 | null
}

export function summarizeVotes(votes: Vote[], userId: string | undefined): VoteSummary {
  const likes = votes.filter((v) => v.value === 1).length
  const dislikes = votes.length - likes
  return { likes, dislikes, score: likes - dislikes, mine: votes.find((v) => v.user_id === userId)?.value ?? null }
}

/** Beste Bewertung zuerst, bei Gleichstand mehr Stimmen, dann die neueren. */
export function sortSuggestions(list: Suggestion[]): Suggestion[] {
  return [...list].sort((a, b) => {
    const sa = summarizeVotes(a.votes, undefined)
    const sb = summarizeVotes(b.votes, undefined)
    return sb.score - sa.score || b.votes.length - a.votes.length || b.created_at.localeCompare(a.created_at)
  })
}

/** Neue Stimme nach Klick: gleiche Stimme nochmal nimmt sie zurück. */
export function nextVote(current: 1 | -1 | null, clicked: 1 | -1): 1 | -1 | null {
  return current === clicked ? null : clicked
}

export async function loadSuggestions(tripId: string): Promise<Suggestion[]> {
  const { data, error } = await requireSupabase()
    .from('suggestions')
    .select(
      'id, trip_id, kind, title, note, link, status, created_by, created_at, place:places(id, name, lat, lng, address), votes:suggestion_votes(user_id, value)',
    )
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as unknown as Suggestion[]
}

export interface SuggestionDraft {
  kind: SuggestionKind
  title: string
  note: string | null
  link: string | null
}

export async function saveSuggestion(
  tripId: string,
  id: string | null,
  draft: SuggestionDraft,
  place: PlaceInput | Place | null,
) {
  const placeId = await ensurePlace(tripId, place)
  const row = { ...draft, place_id: placeId, trip_id: tripId }
  const db = requireSupabase()
  const { error } = id
    ? await db.from('suggestions').update(row).eq('id', id)
    : await db.from('suggestions').insert(row)
  if (error) throw new Error(error.message)
}

export async function setVote(suggestionId: string, userId: string, value: 1 | -1 | null) {
  const db = requireSupabase()
  const { error } =
    value === null
      ? await db.from('suggestion_votes').delete().eq('suggestion_id', suggestionId).eq('user_id', userId)
      : await db
          .from('suggestion_votes')
          .upsert({ suggestion_id: suggestionId, user_id: userId, value }, { onConflict: 'suggestion_id,user_id' })
  if (error) throw new Error(error.message)
}

export async function acceptSuggestion(
  id: string,
  as: 'activity' | 'stay',
  options: { stageId: string | null; date: string | null; status: ActivityStatus },
) {
  const { error } = await requireSupabase().rpc('accept_suggestion', {
    p_suggestion: id,
    p_as: as,
    p_stage: options.stageId,
    p_date: options.date,
    p_status: options.status,
  })
  if (error) throw new Error(error.message)
}

export async function rejectSuggestion(id: string, userId: string) {
  const { error } = await requireSupabase()
    .from('suggestions')
    .update({ status: 'rejected', decided_by: userId, decided_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteSuggestion(id: string) {
  const { error } = await requireSupabase().from('suggestions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
