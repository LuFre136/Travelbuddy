import { useState } from 'react'
import type { Trip } from '../../lib/types'
import type { TripPlan } from '../../lib/plan'
import { TextButton } from '../../components/ui'

export interface TabProps {
  trip: Trip
  plan: TripPlan
  canEdit: boolean
  reload: () => Promise<void>
}

/** Zwei Schritte statt confirm(), das in installierten Apps unzuverlässig ist. */
export function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!armed) {
    return (
      <TextButton onClick={() => setArmed(true)} className="text-red-700 dark:text-red-400">
        Löschen
      </TextButton>
    )
  }
  return (
    <span className="flex items-center gap-3">
      <TextButton
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onDelete()
          } finally {
            setBusy(false)
            setArmed(false)
          }
        }}
        className="font-semibold text-red-700 dark:text-red-400"
      >
        Wirklich löschen
      </TextButton>
      <TextButton onClick={() => setArmed(false)}>Abbrechen</TextButton>
    </span>
  )
}

export function EmptyState({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
      {children}
    </p>
  )
}
