# Travelbuddy

Kostenlose Web-App (PWA) für Handy und Laptop, um Reisen gemeinsam zu planen: mehrere Reisen, Einladungen per Link,
Rollen (Host, Travelguide, Travelbuddy), Unterkünfte, Transfers mit Wegpunkten, Aktivitäten, Karte und Vorschläge mit
Like/Dislike.

Umsetzungsplan: https://claude.ai/artifact/2XRgeuEtL9hMcKzDWVDhw4

## Stand

Meilensteine M0 bis M3:

- React + Vite + TypeScript + Tailwind, als PWA installierbar
- Anmeldung per Magic Link oder Google (Supabase Auth)
- Reisen anlegen und auflisten, Mitglieder ansehen
- Einladungslinks erstellen und einlösen (`/join/<token>`)
- Komplettes Datenbankschema mit Row Level Security für alle Rollen (`supabase/migrations`)
- Reiseplan: Unterkünfte, Transfers mit sortierbaren Wegpunkten, Aktivitäten (optional/eingeplant) und eine
  Tagesansicht mit Übernachtungen; Ortssuche über Photon (OpenStreetMap)
- Karte (MapLibre mit OpenFreeMap-Kacheln, ohne API-Schlüssel): Unterkünfte, Aktivitäten und Wegpunkte als Punkte,
  Transfers als Linien, Filter nach Tag und Art

## Rollen

| Aktion | Host | Travelguide | Travelbuddy |
| --- | :-: | :-: | :-: |
| Reise ansehen, Vorschläge machen, abstimmen | ✓ | ✓ | ✓ |
| Vorschläge übernehmen/ablehnen | ✓ | ✓ | – |
| Unterkünfte, Transfers, Aktivitäten bearbeiten | ✓ | ✓ | – |
| Einladen | ✓ (Buddies und Travelguides) | ✓ (nur Buddies) | – |
| Rollen vergeben, Reise ändern/löschen, Host übertragen | ✓ | – | – |

Die Regeln sind in der Datenbank erzwungen (RLS), nicht nur in der Oberfläche.

## Einrichtung

### 1. Supabase-Projekt

1. Auf [supabase.com](https://supabase.com) kostenlos ein Projekt anlegen, Region **Frankfurt (eu-central-1)**.
2. Schema einspielen, entweder
   - mit der CLI: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`, oder
   - im Dashboard unter **SQL Editor** den Inhalt jeder Datei in `supabase/migrations/` ausführen, der Reihe nach
     (Dateinamen beginnen mit Datum und Uhrzeit). Bei späteren Updates nur die neuen Dateien ausführen.
3. **Authentication → URL Configuration:** Site URL auf die spätere App-Adresse setzen (z. B.
   `https://travelbuddy.onrender.com`, die genaue Adresse zeigt Render nach dem ersten Deploy) und unter Redirect
   URLs `http://localhost:5173/**` sowie `https://travelbuddy.onrender.com/**` eintragen.
4. **Authentication → Email Templates → Magic Link:** Betreff `Dein Travelbuddy-Anmeldecode` und als Inhalt den Text
   aus `supabase/templates/magic_link.html` einfügen. Erst dann enthält die Mail den 6-stelligen Code, den man in der
   installierten App auf dem iPhone eintippt (dort funktioniert der Link nicht, weil er Safari öffnet).
5. Optional **Authentication → Providers → Google** aktivieren (braucht eine OAuth-Client-ID aus der Google Cloud
   Console). Ohne Google funktioniert der Magic Link trotzdem.

### 2. Lokal starten

```bash
cp .env.example .env.local   # URL und anon key aus Project Settings → API eintragen
npm install
npm run dev
```

### 3. Deploy auf Render

Die Konfiguration liegt in `render.yaml` (Render Blueprint).

1. Auf [render.com](https://render.com) kostenlos anmelden und GitHub verbinden.
2. **New → Blueprint** wählen und dieses Repo auswählen.
3. Die abgefragten Werte `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` eintragen und **Apply** klicken.

Render baut die App und stellt sie unter `https://travelbuddy.onrender.com` (oder einer ähnlichen Adresse) bereit. Jeder
Push auf `main` deployt automatisch. Statische Seiten sind bei Render kostenlos und schlafen nicht ein.

### 4. Auf dem Handy installieren

Adresse im Browser öffnen, auf dem iPhone in **Safari** über Teilen → **Zum Home-Bildschirm**, unter Android über das
Browsermenü → **App installieren**.

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
