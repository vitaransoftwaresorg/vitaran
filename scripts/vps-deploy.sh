#!/usr/bin/env bash
# Production deploy on the VPS (called from GitHub Actions over SSH).
# Safe for a live app: migrate deploy only, no reset/seed, no teacher-resource re-import.
set -euo pipefail

ROOT="/srv/apps/vitaranlearning"
cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"

# Match origin/main exactly. Keep durable env + OMR temp data.
git fetch origin main
git reset --hard origin/main
git clean -fd -e backend/.env -e frontend/.env.production -e backend/data
rm -f frontend/.env.local

if [ ! -f frontend/.env.production ] || [ ! -f backend/.env ]; then
  echo "Missing production env (frontend/.env.production and/or backend/.env)" >&2
  exit 1
fi

cd backend
npm ci
# postinstall already runs prisma generate; migrate does not need a second generate.
npx prisma migrate deploy
# Teacher resources live in PostgreSQL + object storage. Do not re-import on every deploy.
# Manual one-off: npm run db:import-teacher-resources
npm run build

cd ../frontend
npm ci
npm run build

cd "$ROOT"
pm2 startOrReload ecosystem.config.cjs --only vitaranlearning-api --update-env
pm2 startOrReload ecosystem.config.cjs --only vitaranlearning-web --update-env
pm2 save
pm2 status vitaranlearning-api vitaranlearning-web
