#!/usr/bin/env bash
# Spielt alle Migrationen in eine frische Datenbank ein und führt die RLS-Tests aus.
# Erwartet eine erreichbare Postgres-Instanz (PGHOST, PGUSER, PGPASSWORD ...).
set -euo pipefail
cd "$(dirname "$0")/.."

DB="${TEST_DB:-travelbuddy_test}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"

run() { psql -v ON_ERROR_STOP=1 -q -X -o /dev/null -d "$DB" -f "$1"; }

run supabase/tests/shim.sql
for f in supabase/migrations/*.sql; do run "$f"; done
run supabase/tests/rls_test.sql

echo "DB-Tests erfolgreich"
