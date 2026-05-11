#!/bin/sh
set -e

# ── 1. Wait for the database ──────────────────────────────────────────────────
# Coolify starts containers in parallel; the app container may come up before
# Postgres is ready. Retry the migration up to 30 times (60 s) before giving up.
MAX_RETRIES=30
RETRY_INTERVAL=2
attempt=1

until node -r ./register.js -e "
  const { DataSource } = require('typeorm');
  const ds = require('./dist/database/data-source').default;
  ds.initialize().then(() => ds.destroy()).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
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
