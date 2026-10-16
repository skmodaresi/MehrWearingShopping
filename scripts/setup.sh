#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# MehrWearingShopping — one-shot local setup
#
#   ./scripts/setup.sh        (or: bun run setup)
#
# Installs dependencies, creates the .env files from their templates and
# prepares a seeded local database. Safe to re-run.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }

copy_env() { # copy_env <target> <template>
  if [[ -f "$1" ]]; then
    printf '  kept existing %s\n' "$1"
  else
    cp "$2" "$1"
    printf '  created %s\n' "$1"
  fi
}

step "Installing dependencies (bun)"
if command -v bun >/dev/null 2>&1; then
  bun install
else
  echo "bun is required: https://bun.sh" >&2
  exit 1
fi

step "Writing environment files"
copy_env apps/api/.env apps/api/.env.example
copy_env apps/web/.env apps/web/.env.example
copy_env apps/mobile/.env apps/mobile/.env.example

step "Building the shared API client"
bun run build:client

# A TCP probe instead of pg_isready: the embedded PostgreSQL ships without
# client binaries on PATH, and this must work on a bare machine.
db_up() {
  node -e "
    const net = require('net');
    const s = net.connect({ port: 5433, host: '127.0.0.1' }, () => { s.end(); process.exit(0); });
    s.on('error', () => process.exit(1));
    setTimeout(() => process.exit(1), 2000);
  " >/dev/null 2>&1
}

step "Starting the local PostgreSQL server"
if db_up; then
  echo "  already running on 127.0.0.1:5433"
else
  echo "  starting in the background (log: /tmp/mehrwearing-db.log)"
  nohup bun run db:start >/tmp/mehrwearing-db.log 2>&1 &
  for _ in $(seq 1 30); do
    db_up && break
    sleep 1
  done
  db_up || {
    echo "  database did not come up — check /tmp/mehrwearing-db.log" >&2
    exit 1
  }
fi

step "Applying migrations and seeding the catalog"
bun run db:migrate
bun run db:seed

cat <<'DONE'

✓ Setup complete. Start developing:

    bun run dev          # API :4000 + storefront :3000
    bun run dev:mobile   # Expo starter (separate shell)

Seeded accounts:
    admin@mehrwearing.ir / ChangeMe!Admin123
    demo@mehrwearing.ir  / Demo@12345

Smoke tests (API + storefront):  bun run smoke && bun run smoke:web
DONE
