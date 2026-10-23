import { describe, expect, it } from 'vitest'
import { nextVote, sortSuggestions, summarizeVotes, type Suggestion, type Vote } from './suggestions'

function suggestion(id: string, votes: Vote[], created_at = '2027-01-01T00:00:00Z'): Suggestion {
  return {
    id,
    trip_id: 't',
    kind: 'food',
    title: id,
    note: null,
    link: null,
    status: 'open',
    created_by: 'u',
    created_at,
    place: null,
    votes,
  }
}

describe('Vorschläge', () => {
  it('zählt Likes, Dislikes und die eigene Stimme', () => {
    const votes: Vote[] = [
      { user_id: 'a', value: 1 },
      { user_id: 'b', value: 1 },
      { user_id: 'c', value: -1 },
    ]
    expect(summarizeVotes(votes, 'c')).toEqual({ likes: 2, dislikes: 1, score: 1, mine: -1 })
    expect(summarizeVotes([], 'c').mine).toBeNull()
  })

  it('sortiert nach Bewertung, dann nach Anzahl Stimmen, dann neueste zuerst', () => {
    const list = [
      suggestion('neu', [], '2027-01-03T00:00:00Z'),
      suggestion('alt', [], '2027-01-01T00:00:00Z'),
      suggestion('top', [{ user_id: 'a', value: 1 }]),
      suggestion('umstritten', [
        { user_id: 'a', value: 1 },
        { user_id: 'b', value: -1 },
      ]),
      suggestion('flop', [{ user_id: 'a', value: -1 }]),
    ]
    expect(sortSuggestions(list).map((s) => s.id)).toEqual(['top', 'umstritten', 'neu', 'alt', 'flop'])
  })

  it('nimmt eine Stimme bei erneutem Klick zurück', () => {
    expect(nextVote(null, 1)).toBe(1)
    expect(nextVote(1, 1)).toBeNull()
    expect(nextVote(1, -1)).toBe(-1)
  })
})
