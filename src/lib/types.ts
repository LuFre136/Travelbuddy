export type TripRole = 'host' | 'guide' | 'buddy'

export interface Trip {
  id: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
}

export const roleLabels: Record<TripRole, string> = {
  host: 'Host',
  guide: 'Travelguide',
  buddy: 'Travelbuddy',
}

export function canEditPlan(role: TripRole | null | undefined): boolean {
  return role === 'host' || role === 'guide'
}
