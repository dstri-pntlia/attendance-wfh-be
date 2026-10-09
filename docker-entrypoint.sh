#!/bin/sh
set -e

echo "==> Running migrations"
node node_modules/typeorm/cli.js migration:run -d dist/core/database/data-source.js

if [ "${SEED_ON_START}" = "true" ]; then
  echo "==> Seeding (idempotent)"
  node dist/core/database/seeds/run-seed.js
fi

echo "==> Starting API"
exec "$@"
