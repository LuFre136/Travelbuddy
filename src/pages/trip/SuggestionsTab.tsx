import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { PlacePicker } from '../../components/PlacePicker'
import { StageField } from '../../components/StageField'
import {
  Button,
  Card,
  ErrorText,
  Field,
  Input,
  SecondaryButton,
  Select,
  Textarea,
  TextButton,
} from '../../components/ui'
import { emptyToNull } from '../../lib/format'
import type { PlaceInput } from '../../lib/places'
import { activityStatusLabels, type ActivityStatus, type Place } from '../../lib/plan'
import { stageForDay } from '../../lib/stages'
import {
  acceptSuggestion,
  deleteSuggestion,
  loadSuggestions,
  nextVote,
  rejectSuggestion,
  saveSuggestion,
  setVote,
  sortSuggestions,
  suggestionKindLabels,
  suggestionStatusLabels,
  summarizeVotes,
  type Suggestion,
  type SuggestionKind,
  type SuggestionStatus,
} from '../../lib/suggestions'
import type { Member } from './MembersTab'
import { DeleteButton, EmptyState, type TabProps } from './shared'

interface Props extends TabProps {
  members: Member[]
  userId: string | undefined
}

export function SuggestionsTab({ trip, plan, canEdit, reload, members, userId }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [filter, setFilter] = useState<SuggestionStatus>('open')
  const [editing, setEditing] = useState<Suggestion | 'new' | null>(null)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setSuggestions(await loadSuggestions(trip.id))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [trip.id])

  useEffect(() => {
    load()
  }, [load])

  async function run(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.profiles?.display_name ?? 'Jemand'
  const counts = (status: SuggestionStatus) => suggestions?.filter((s) => s.status === status).length ?? 0
  const visible = sortSuggestions((suggestions ?? []).filter((s) => s.status === filter))

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Alle Mitreisenden können Orte, Essen oder Aktivitäten vorschlagen und mit 👍 oder 👎 abstimmen.
        {canEdit
          ? ' Du kannst Vorschläge in den Plan übernehmen.'
          : ' Host und Travelguides übernehmen sie in den Plan.'}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editing === null ? <Button onClick={() => setEditing('new')}>Vorschlag machen</Button> : <span />}
        <div
          role="group"
          aria-label="Filter"
          className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800"
        >
          {(['open', 'accepted', 'rejected'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 ${filter === f ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-600 dark:text-slate-400'}`}
            >
              {suggestionStatusLabels[f]} {counts(f) > 0 && <span className="text-slate-500">{counts(f)}</span>}
            </button>
          ))}
        </div>
      </div>

      {editing === 'new' && (
        <SuggestionForm
          tripId={trip.id}
          onDone={async (saved) => {
            setEditing(null)
            if (saved) {
              setFilter('open')
              await load()
            }
          }}
        />
      )}

      {suggestions === null && !error && <p className="text-sm text-slate-500">Lädt …</p>}
      {suggestions !== null && visible.length === 0 && editing === null && (
        <EmptyState>
          {filter === 'open' ? 'Noch keine offenen Vorschläge. Mach den ersten!' : 'Hier ist noch nichts.'}
        </EmptyState>
      )}

      <ul className="space-y-3">
        {visible.map((s) => {
          if (editing !== 'new' && editing?.id === s.id) {
            return (
              <li key={s.id}>
                <SuggestionForm
                  tripId={trip.id}
                  suggestion={s}
                  onDone={async (saved) => {
                    setEditing(null)
                    if (saved) await load()
                  }}
                />
              </li>
            )
          }
          const votes = summarizeVotes(s.votes, userId)
          const mineOpen = s.created_by === userId && s.status === 'open'
          return (
            <li key={s.id}>
              <Card className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs tracking-wide text-slate-500 uppercase">
                      {suggestionKindLabels[s.kind]}
                    </span>
                    <h3 className="font-medium">{s.title}</h3>
                    {s.place && s.place.name !== s.title && (
                      <p className="text-sm text-slate-500">{s.place.address ?? s.place.name}</p>
                    )}
                    {s.note && <p className="mt-1 text-sm whitespace-pre-line">{s.note}</p>}
                    {s.link && (
                      <a
                        href={s.link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate text-sm text-brand-700 hover:underline dark:text-brand-100"
                      >
                        {s.link}
                      </a>
                    )}
                    <p className="mt-1 text-xs text-slate-500">von {nameOf(s.created_by)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1" role="group" aria-label="Abstimmen">
                    <VoteButton
                      label="Gefällt mir"
                      emoji="👍"
                      count={votes.likes}
                      active={votes.mine === 1}
                      disabled={!userId || s.status !== 'open'}
                      onClick={() => run(() => setVote(s.id, userId!, nextVote(votes.mine, 1)))}
                    />
                    <VoteButton
                      label="Gefällt mir nicht"
                      emoji="👎"
                      count={votes.dislikes}
                      active={votes.mine === -1}
                      disabled={!userId || s.status !== 'open'}
                      onClick={() => run(() => setVote(s.id, userId!, nextVote(votes.mine, -1)))}
                    />
                  </div>
                </div>

                {accepting === s.id ? (
                  <AcceptForm
                    suggestion={s}
                    stages={plan.stages}
                    tripStart={trip.start_date}
                    onCancel={() => setAccepting(null)}
                    onAccept={async (as, options) => {
                      await acceptSuggestion(s.id, as, options)
                      setAccepting(null)
                      await Promise.all([load(), reload()])
                    }}
                  />
                ) : (
                  (canEdit || mineOpen) &&
                  s.status === 'open' && (
                    <div className="flex flex-wrap items-center gap-4">
                      {canEdit && (
                        <>
                          <TextButton className="font-medium" onClick={() => setAccepting(s.id)}>
                            In den Plan übernehmen
                          </TextButton>
                          <TextButton onClick={() => run(() => rejectSuggestion(s.id, userId!))}>Ablehnen</TextButton>
                        </>
                      )}
                      {mineOpen && <TextButton onClick={() => setEditing(s)}>Bearbeiten</TextButton>}
                      <DeleteButton onDelete={() => run(() => deleteSuggestion(s.id))} />
                    </div>
                  )
                )}
              </Card>
            </li>
          )
        })}
      </ul>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

function VoteButton({
  label,
  emoji,
  count,
  active,
  disabled,
  onClick,
}: {
  label: string
  emoji: string
  count: number
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm tabular-nums disabled:opacity-60 ${
        active
          ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-800/40 dark:text-brand-100'
          : 'border-slate-300 dark:border-slate-700'
      }`}
    >
      <span aria-hidden>{emoji}</span>
      {count}
    </button>
  )
}

function AcceptForm({
  suggestion,
  stages,
  tripStart,
  onCancel,
  onAccept,
}: {
  suggestion: Suggestion
  stages: TabProps['plan']['stages']
  tripStart: string | null
  onCancel: () => void
  onAccept: (
    as: 'activity' | 'stay',
    options: { stageId: string | null; date: string | null; status: ActivityStatus },
  ) => Promise<void>
}) {
  const [as, setAs] = useState<'activity' | 'stay'>(suggestion.kind === 'stay' ? 'stay' : 'activity')
  const [stageId, setStageId] = useState<string | null>(null)
  const [date, setDate] = useState('')
  const [status, setStatus] = useState<ActivityStatus>('planned')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prefix = `accept-${suggestion.id}`

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onAccept(as, {
        stageId: stageId ?? stageForDay(stages, date || null)?.id ?? null,
        date: date || null,
        status,
      })
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-800/50">
      <Field label="Übernehmen als" htmlFor={`${prefix}-as`}>
        <Select id={`${prefix}-as`} value={as} onChange={(e) => setAs(e.target.value as 'activity' | 'stay')}>
          <option value="activity">Aktivität</option>
          <option value="stay">Unterkunft</option>
        </Select>
      </Field>
      {as === 'activity' && (
        <Field label="Status" htmlFor={`${prefix}-status`}>
          <Select id={`${prefix}-status`} value={status} onChange={(e) => setStatus(e.target.value as ActivityStatus)}>
            {(['planned', 'optional'] as const).map((s) => (
              <option key={s} value={s}>
                {activityStatusLabels[s]}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {stages.length > 0 && (
        <div className="sm:col-span-2">
          <StageField
            id={`${prefix}-stage`}
            stages={stages}
            tripStart={tripStart}
            stageId={stageId}
            day={date || null}
            onStage={setStageId}
            onDay={setDate}
          />
        </div>
      )}
      <Field label={as === 'stay' ? 'Check-in (optional)' : 'Datum (optional)'} htmlFor={`${prefix}-date`}>
        <Input id={`${prefix}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="flex flex-wrap items-end gap-3 sm:col-span-2">
        <Button type="submit" disabled={busy}>
          Übernehmen
        </Button>
        <SecondaryButton type="button" onClick={onCancel}>
          Abbrechen
        </SecondaryButton>
      </div>
      <div className="sm:col-span-2">
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  )
}

function SuggestionForm({
  tripId,
  suggestion,
  onDone,
}: {
  tripId: string
  suggestion?: Suggestion
  onDone: (saved: boolean) => Promise<void>
}) {
  const [kind, setKind] = useState<SuggestionKind>(suggestion?.kind ?? 'activity')
  const [title, setTitle] = useState(suggestion?.title ?? '')
  const [place, setPlace] = useState<PlaceInput | Place | null>(suggestion?.place ?? null)
  const [note, setNote] = useState(suggestion?.note ?? '')
  const [link, setLink] = useState(suggestion?.link ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prefix = suggestion?.id ?? 'new'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveSuggestion(
        tripId,
        suggestion?.id ?? null,
        {
          kind,
          title: title.trim() || place?.name || suggestionKindLabels[kind],
          note: emptyToNull(note),
          link: emptyToNull(link),
        },
        place,
      )
      await onDone(true)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <h3 className="font-semibold sm:col-span-2">{suggestion ? 'Vorschlag bearbeiten' : 'Neuer Vorschlag'}</h3>
        <Field label="Art" htmlFor={`${prefix}-sg-kind`}>
          <Select id={`${prefix}-sg-kind`} value={kind} onChange={(e) => setKind(e.target.value as SuggestionKind)}>
            {Object.entries(suggestionKindLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Was?" htmlFor={`${prefix}-sg-title`}>
          <Input
            id={`${prefix}-sg-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={place?.name ?? 'z. B. Tapas-Bar am Hafen'}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Ort (optional)" htmlFor={`${prefix}-sg-place`}>
            <PlacePicker id={`${prefix}-sg-place`} value={place} onChange={setPlace} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Warum? (optional)" htmlFor={`${prefix}-sg-note`}>
            <Textarea id={`${prefix}-sg-note`} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Link (optional)" htmlFor={`${prefix}-sg-link`}>
            <Input
              id={`${prefix}-sg-link`}
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <Button type="submit" disabled={busy || (!title.trim() && !place)}>
            {suggestion ? 'Speichern' : 'Vorschlagen'}
          </Button>
          <SecondaryButton type="button" onClick={() => onDone(false)}>
            Abbrechen
          </SecondaryButton>
        </div>
        <div className="sm:col-span-2">
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </Card>
  )
}
