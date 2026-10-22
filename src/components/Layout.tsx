import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { supabase } from '../lib/supabase'

export function Layout() {
  const { session } = useAuth()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold text-brand-700 dark:text-brand-100">
            <img src="/icon.svg" alt="" className="size-7" />
            Travelbuddy
          </Link>
          {session && (
            <button
              type="button"
              onClick={() => supabase?.auth.signOut()}
              className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Abmelden
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
