# Whisperoo — Fly.io deployment script
# Run from the repo root: .\scripts\fly-deploy.ps1
#
# Prerequisites:
#   1. flyctl installed: iwr https://fly.io/install.ps1 -useb | iex
#   2. Logged in:        flyctl auth login
#   3. App created:      flyctl apps create whisperoo-app  (skip if already exists)

$ErrorActionPreference = "Stop"

# ── Load .env ────────────────────────────────────────────────────────────────
$envFile = Join-Path (Join-Path $PSScriptRoot "..") ".env"
if (-not (Test-Path $envFile)) {
    Write-Error ".env not found at $envFile"
    exit 1
}

$envVars = @{}
Get-Content $envFile | Where-Object { $_ -match "^\s*([A-Za-z_][^=]*)=(.*)$" } | ForEach-Object {
    $key   = $Matches[1].Trim()
    $value = $Matches[2].Trim()
    $envVars[$key] = $value
}

# ── Deploy with VITE_* vars as Docker build args ──────────────────────────────
# These are baked into the React bundle at build time (Dockerfile.fly uses ARG).
# They are NOT secrets — they'll be visible in the compiled JS bundle regardless.
Write-Host "`nDeploying to Fly.io with build args..." -ForegroundColor Cyan

flyctl deploy `
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

# ── Custom domain certificate for app subdomain ───────────────────────────────
Write-Host "`nIssuing TLS certificate for app.whisperoo.app..." -ForegroundColor Cyan
flyctl certs create app.whisperoo.app

Write-Host "`n--- GoDaddy DNS record needed for app subdomain ---" -ForegroundColor Yellow
flyctl certs show app.whisperoo.app

Write-Host "`nAll done. Manual steps remaining:" -ForegroundColor Green
Write-Host "  1. GoDaddy DNS — add these for the app subdomain:"
Write-Host "       A    app  →  66.241.124.194"
Write-Host "       AAAA app  →  2a09:8280:1::10e:7a7c:0"
Write-Host "  2. GoDaddy DNS — point root to Framer (get values from Framer dashboard):"
Write-Host "       Remove existing A @ records pointing to Fly.io"
Write-Host "       Add Framer's A/CNAME records for @ and www"
Write-Host "  3. Supabase Dashboard -> Auth -> URL Configuration:"
Write-Host "       Site URL:      https://app.whisperoo.app"
Write-Host "       Redirect URLs: https://app.whisperoo.app/**"
Write-Host "                      https://whisperoo-production.up.railway.app/** (keep for QR codes)"
Write-Host "  4. Framer: publish to whisperoo.app custom domain"
Write-Host "  5. Push to Railway to activate QR-code redirect (now targets app.whisperoo.app)"
