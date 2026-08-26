# Whisperoo — Fly.io STAGING deployment script
# Run from the repo root: .\scripts\fly-deploy-staging.ps1
#
# ⚠️  STAGING ONLY. The production equivalent is scripts\fly-deploy.ps1.
#     This script reads .env.staging and deploys to the "whisperoo-staging" app
#     via fly.staging.toml. It will refuse to run if those don't line up.
#
# Prerequisites:
#   1. flyctl installed: iwr https://fly.io/install.ps1 -useb | iex
#   2. Logged in:        flyctl auth login
#   3. App created:      flyctl apps create whisperoo-staging
#   4. .env.staging populated with the STAGING Supabase + Stripe test values

$ErrorActionPreference = "Stop"

$repoRoot   = Join-Path $PSScriptRoot ".."
$envFile    = Join-Path $repoRoot ".env.staging"
$configFile = Join-Path $repoRoot "fly.staging.toml"

# -- Load .env.staging --------------------------------------------------------
if (-not (Test-Path $envFile)) {
    Write-Error ".env.staging not found at $envFile"
    exit 1
}
if (-not (Test-Path $configFile)) {
    Write-Error "fly.staging.toml not found at $configFile"
    exit 1
}

$envVars = @{}
Get-Content $envFile | Where-Object { $_ -match "^\s*([A-Za-z_][^=]*)=(.*)$" } | ForEach-Object {
    $key   = $Matches[1].Trim()
    $value = $Matches[2].Trim()
    $envVars[$key] = $value
}

# -- Safety rails -------------------------------------------------------------
# The whole point of staging is that it cannot accidentally become production.
# These checks are cheap; a mis-deploy is not.

$prodProjectRef = "wznevejkaefokgibkknt"
$stagingRef     = "auttveumgltfedjptwfw"

$supabaseUrl = $envVars['VITE_SUPABASE_URL']
if ([string]::IsNullOrWhiteSpace($supabaseUrl)) {
    Write-Error "VITE_SUPABASE_URL is missing from .env.staging."
    exit 1
}
if ($supabaseUrl -like "*$prodProjectRef*") {
    Write-Error "REFUSING TO DEPLOY: .env.staging points at the PRODUCTION Supabase project ($prodProjectRef). Expected staging ($stagingRef)."
    exit 1
}
if ($supabaseUrl -notlike "*$stagingRef*") {
    Write-Warning "VITE_SUPABASE_URL does not contain the expected staging ref ($stagingRef). Value: $supabaseUrl"
    $answer = Read-Host "Continue anyway? (y/N)"
    if ($answer -ne "y") { exit 1 }
}

# Live Stripe keys must never reach staging - a test checkout would charge a real card.
$stripeKey = $envVars['VITE_STRIPE_PUBLISHABLE_KEY']
if ($stripeKey -and $stripeKey.StartsWith("pk_live_")) {
    Write-Error "REFUSING TO DEPLOY: VITE_STRIPE_PUBLISHABLE_KEY is a LIVE key (pk_live_). Staging must use a pk_test_ key."
    exit 1
}

Write-Host "Safety checks passed - deploying to STAGING (app: whisperoo-staging)." -ForegroundColor Green

# -- Deploy with VITE_* vars as Docker build args -----------------------------
# These are baked into the React bundle at build time (Dockerfile.fly uses ARG).
# They are NOT secrets - they'll be visible in the compiled JS bundle regardless.
Write-Host "`nDeploying to Fly.io with build args..." -ForegroundColor Cyan

flyctl deploy `
    -c $configFile `
    --no-cache `
    --build-arg "VITE_SUPABASE_URL=$($envVars['VITE_SUPABASE_URL'])" `
    --build-arg "VITE_SUPABASE_ANON_KEY=$($envVars['VITE_SUPABASE_ANON_KEY'])" `
    --build-arg "VITE_STRIPE_PUBLISHABLE_KEY=$($envVars['VITE_STRIPE_PUBLISHABLE_KEY'])" `
    --build-arg "VITE_CLOUDFLARE_ACCOUNT_ID=$($envVars['VITE_CLOUDFLARE_ACCOUNT_ID'])" `
    --build-arg "VITE_CLOUDFLARE_R2_BUCKET_NAME=$($envVars['VITE_CLOUDFLARE_R2_BUCKET_NAME'])" `
    --build-arg "VITE_CLOUDFLARE_R2_PUBLIC_URL=$($envVars['VITE_CLOUDFLARE_R2_PUBLIC_URL'])"

if ($LASTEXITCODE -ne 0) {
    Write-Error "fly deploy failed."
    exit 1
}

# -- Custom domain certificate ------------------------------------------------
Write-Host "`nIssuing TLS certificate for staging.whisperoo.app..." -ForegroundColor Cyan
flyctl certs create staging.whisperoo.app -c $configFile

Write-Host "`n--- GoDaddy DNS record needed for the staging subdomain ---" -ForegroundColor Yellow
flyctl certs show staging.whisperoo.app -c $configFile

Write-Host "`nAll done. Manual steps remaining:" -ForegroundColor Green
Write-Host "  1. GoDaddy DNS - add the A/AAAA records printed above for host 'staging'."
Write-Host "     (Use the values from 'certs show' - do NOT copy production's IPs.)"
Write-Host "  2. STAGING Supabase Dashboard ($stagingRef) -> Auth -> URL Configuration:"
Write-Host "       Site URL:      https://staging.whisperoo.app"
Write-Host "       Redirect URLs: https://staging.whisperoo.app/**"
Write-Host "  3. Confirm the app booted on its *.fly.dev URL before relying on DNS."
Write-Host "  4. Do NOT point Railway QR redirects at staging - those stay on production."
