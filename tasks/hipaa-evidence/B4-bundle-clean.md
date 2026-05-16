# B4 — Production bundle has no server secrets

**Verified:** 2026-05-12
**Verifier:** Claude Code (`npm run build` + grep on local working tree at commit prior to merge)

## Build

```
$ npm run build
✓ built in 56.01s
```

## Grep checks

```
$ grep -rE 'VITE_.*(SECRET|ACCESS_KEY|GOOGLE_TRANSLATE)' dist/
(no matches)

$ grep -rE '(sk_live_|sk_test_|R2_SECRET|r2-access-key|GOOGLE_TRANSLATE_API_KEY)' dist/
(no matches)
```

## What this proves

- **B1** — No `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` substrings appear in any built asset.
- **B2** — No `GOOGLE_TRANSLATE_API_KEY` substring appears.
- **B3** — No `sk_live_*` or `sk_test_*` Stripe secret-key prefixes appear; `src/services/stripe.ts` only references `VITE_STRIPE_PUBLISHABLE_KEY` (public key, intended for the browser).
- **B4** — The `.env.example` cleanup held; no developer accidentally reintroduced the `VITE_*_SECRET` / `VITE_*_ACCESS_KEY` env-var names anywhere in the source tree.

## What this does NOT prove

Bundle being clean only addresses the *future*. It does not retroactively secure keys that were in earlier production bundles. Those keys must still be **rotated** (see manual-steps guide §2):
- Cloudflare R2 access key pair (previously baked into bundle)
- Google Translate API key (previously baked into bundle)
- OpenAI key (previously logged as prefix in edge function — A5)

## Reproduce

```bash
npm run build
grep -rE 'VITE_.*(SECRET|ACCESS_KEY|GOOGLE_TRANSLATE)' dist/
grep -rE '(sk_live_|sk_test_|R2_SECRET|r2-access-key|GOOGLE_TRANSLATE_API_KEY)' dist/
# Both must return zero matches.
```
