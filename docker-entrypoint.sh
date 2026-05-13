#!/bin/sh
set -e

# ── 0. Startup diagnostics ────────────────────────────────────────────────────
echo "[entrypoint] ── Database connection parameters ──────────────────"
echo "[entrypoint]   DB_HOST     = ${DB_HOST:-(not set)}"
echo "[entrypoint]   DB_PORT     = ${DB_PORT:-(not set)}"
echo "[entrypoint]   DB_USERNAME = ${DB_USERNAME:-(not set)}"
echo "[entrypoint]   DB_DATABASE = ${DB_DATABASE:-(not set)}"
echo "[entrypoint]   DB_SCHEMA   = ${DB_SCHEMA:-(not set)}"
echo "[entrypoint]   DB_SSL      = ${DB_SSL:-(not set)}"
echo "[entrypoint]   NODE_ENV    = ${NODE_ENV:-(not set)}"
echo "[entrypoint] ─────────────────────────────────────────────────────"

# ── 1. Wait for the database ──────────────────────────────────────────────────
MAX_RETRIES=30
RETRY_INTERVAL=2
attempt=1

until node -r ./register.js -e "
  const ds = require('./dist/database/data-source').default;
  ds.initialize()
    .then(() => ds.destroy())
    .then(() => process.exit(0))
    .catch((err) => {
      process.stderr.write('[entrypoint] Connection error: ' + err.message + '\n');
      process.exit(1);
    });
"; do
  if [ "$attempt" -ge "$MAX_RETRIES" ]; then
    echo "[entrypoint] Database not reachable after ${MAX_RETRIES} attempts. Exiting."
    exit 1
  fi
  echo "[entrypoint] Waiting for database... (attempt ${attempt}/${MAX_RETRIES})"
  attempt=$((attempt + 1))
  sleep "$RETRY_INTERVAL"
done

echo "[entrypoint] Database is ready."

# ── 2. Run migrations ─────────────────────────────────────────────────────────
echo "[entrypoint] Running migrations..."
node -r ./register.js -e "
  const ds = require('./dist/database/data-source').default;
  ds.initialize()
    .then(() => ds.runMigrations({ transaction: 'each' }))
    .then((applied) => {
      console.log('[entrypoint] Applied ' + applied.length + ' migration(s).');
      return ds.destroy();
    })
    .catch((err) => {
      console.error('[entrypoint] Migration failed:', err.message);
      process.exit(1);
    });
"

# ── 3. Start the application ─────────────────────────────────────────────────
echo "[entrypoint] Starting application..."
exec node -r ./register.js dist/main.js
