export function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl space-y-3 p-6">
      <h1 className="text-xl font-semibold">Supabase ist noch nicht verbunden</h1>
      <p className="text-slate-600 dark:text-slate-300">
        Lege eine Datei <code className="font-mono">.env.local</code> an (Vorlage:{' '}
        <code className="font-mono">.env.example</code>) und trage <code className="font-mono">VITE_SUPABASE_URL</code>{' '}
        und <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> aus deinem Supabase-Projekt ein. Die Schritte
        stehen in der README.
      </p>
    </div>
  )
}
