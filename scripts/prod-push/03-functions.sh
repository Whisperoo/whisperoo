#!/usr/bin/env bash
# Phase 3 — edge functions. Deploys every function in supabase/functions to PROD.
# Prod secrets are NOT touched: no STRIPE_WEBHOOK_SECRET yet because no live Stripe
# endpoint exists; OPENAI/R2/Stripe secrets already on prod stay as they are.
source "$(dirname "$0")/_common.sh"

supabase functions deploy --project-ref "$PROD_REF"
echo "== deployed =="
supabase functions list --project-ref "$PROD_REF"
echo "Check: stripe-webhook present with verify_jwt false; admin-signup-export present."
