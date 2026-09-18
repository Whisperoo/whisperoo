#!/usr/bin/env bash
# Phase 5 — confirm the CLI is still pointed at STAGING (phases 0–2 went over psql and
# never re-linked it, so this should already be true).
source "$(dirname "$0")/_common.sh"
echo "linked: $(cat supabase/.temp/project-ref)  (expect $STAGING_REF)"
