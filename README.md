# Travelbuddy

Kostenlose Web-App (PWA) für Handy und Laptop, um Reisen gemeinsam zu planen: mehrere Reisen, Einladungen per Link,
Rollen (Host, Travelguide, Travelbuddy), Unterkünfte, Transfers mit Wegpunkten, Aktivitäten, Karte und Vorschläge mit
Like/Dislike.

Umsetzungsplan: https://claude.ai/artifact/2XRgeuEtL9hMcKzDWVDhw4

## Stand

Meilenstein M0 (Grundgerüst) plus Teile von M1:

- React + Vite + TypeScript + Tailwind, als PWA installierbar
- Anmeldung per Magic Link oder Google (Supabase Auth)
- Reisen anlegen und auflisten, Mitglieder ansehen
- Einladungslinks erstellen und einlösen (`/join/<token>`)
- Komplettes Datenbankschema mit Row Level Security für alle Rollen (`supabase/migrations`)

## Rollen

| Aktion | Host | Travelguide | Travelbuddy |
| --- | :-: | :-: | :-: |
| Reise ansehen, Vorschläge machen, abstimmen | ✓ | ✓ | ✓ |
| Vorschläge übernehmen/ablehnen | ✓ | ✓ | – |
| Unterkünfte, Transfers, Aktivitäten bearbeiten | ✓ | ✓ | – |
| Einladen | ✓ (alle Rollen) | ✓ (nur Buddies) | – |
| Rollen vergeben, Reise ändern/löschen, Host übertragen | ✓ | – | – |

Die Regeln sind in der Datenbank erzwungen (RLS), nicht nur in der Oberfläche.

## Einrichtung

### 1. Supabase-Projekt

1. Auf [supabase.com](https://supabase.com) kostenlos ein Projekt anlegen, Region **Frankfurt (eu-central-1)**.
2. Schema einspielen, entweder
   - mit der CLI: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`, oder
   - im Dashboard unter **SQL Editor** den Inhalt von `supabase/migrations/20261022180000_init.sql` ausführen.
3. **Authentication → URL Configuration:** Site URL auf die spätere App-Adresse setzen (z. B.
   `https://travelbuddy.pages.dev`) und unter Redirect URLs `http://localhost:5173/**` sowie
   `https://travelbuddy.pages.dev/**` eintragen.
4. Optional **Authentication → Providers → Google** aktivieren (braucht eine OAuth-Client-ID aus der Google Cloud
   Console). Ohne Google funktioniert der Magic Link trotzdem.

### 2. Lokal starten

```bash
cp .env.example .env.local   # URL und anon key aus Project Settings → API eintragen
npm install
npm run dev
```

### 3. Deploy auf Cloudflare Pages

Im Cloudflare-Dashboard **Workers & Pages → Create → Pages → Connect to Git** dieses Repo wählen:

- Build command: `npm run build`
- Output directory: `dist`
- Umgebungsvariablen: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Danach baut jeder Push auf `main` die App neu, jeder Pull Request bekommt eine Vorschau-URL.

## Entwicklung

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run lint` | ESLint |
| `npm test` | Unit-Tests (Vitest) |
| `npm run build` | Typecheck und Produktions-Build |
| `npm run test:db` | Migrationen in ein frisches Postgres einspielen und Rechte-Tests ausführen |

`test:db` braucht ein erreichbares Postgres (Variablen `PGHOST`, `PGUSER`, `PGPASSWORD`). In CI läuft es automatisch.
Die Datei `supabase/tests/shim.sql` bildet dafür die nötigen Teile von Supabase (Schema `auth`, Rollen) nach.
