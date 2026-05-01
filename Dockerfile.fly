# ============================================================
# Whisperoo — Multi-stage Docker build for Fly.io deployment
#
# Stage 1: Build the Vite SPA (VITE_* vars must exist here)
# Stage 2: Serve the compiled dist/ with a lightweight server
#
# IMPORTANT — VITE_* variables are baked at build time.
# Pass them as --build-arg when building locally, or set them
# as Fly.io build secrets (fly secrets set VITE_SUPABASE_URL=...)
# ============================================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Accept all VITE_* vars as build args (baked into the bundle)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_CLOUDFLARE_ACCOUNT_ID
ARG VITE_CLOUDFLARE_R2_ACCESS_KEY_ID
ARG VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY
ARG VITE_CLOUDFLARE_R2_BUCKET_NAME
ARG VITE_CLOUDFLARE_R2_PUBLIC_URL
ARG VITE_CLOUDFLARE_R2_ENDPOINT
ARG VITE_GOOGLE_TRANSLATE_API_KEY

# Expose them as environment variables so Vite picks them up
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_CLOUDFLARE_ACCOUNT_ID=$VITE_CLOUDFLARE_ACCOUNT_ID
ENV VITE_CLOUDFLARE_R2_ACCESS_KEY_ID=$VITE_CLOUDFLARE_R2_ACCESS_KEY_ID
ENV VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY=$VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY
ENV VITE_CLOUDFLARE_R2_BUCKET_NAME=$VITE_CLOUDFLARE_R2_BUCKET_NAME
ENV VITE_CLOUDFLARE_R2_PUBLIC_URL=$VITE_CLOUDFLARE_R2_PUBLIC_URL
ENV VITE_CLOUDFLARE_R2_ENDPOINT=$VITE_CLOUDFLARE_R2_ENDPOINT
ENV VITE_GOOGLE_TRANSLATE_API_KEY=$VITE_GOOGLE_TRANSLATE_API_KEY

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build

# ── Stage 2: Serve ──────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install `serve` — a zero-config static file server
RUN npm install -g serve@14

# Copy only the compiled output from the build stage
COPY --from=builder /app/dist ./dist

# Port 8080 is the Fly.io standard internal port
EXPOSE 8080

# -s flag = SPA mode: all unknown routes fall back to index.html
# This is required for React Router client-side routing to work
CMD ["serve", "-s", "dist", "-l", "8080"]
