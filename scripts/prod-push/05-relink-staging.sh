#!/usr/bin/env bash
# Phase 5 — put the CLI back on STAGING so day-to-day commands stay safe.
source "$(dirname "$0")/_common.sh"
STG_PW="$(grep -E '^SUPABASE_DB_PASSWORD=' .env.staging | cut -d= -f2- | tr -d '\r"')"
supabase link --project-ref "$STAGING_REF" --password "$STG_PW"
echo "linked: $(cat supabase/.temp/project-ref)  (expect $STAGING_REF)"
