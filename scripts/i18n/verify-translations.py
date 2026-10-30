"""
Verify our Spanish / Vietnamese strings by BACK-TRANSLATION with Google Translate,
and machine-translate the approved English consent wording into es/vi.

Client instruction (2026-10-31): "you have the Google Translate API key, use it to
verify the translations". This does not replace a bilingual human review; it flags
strings whose meaning drifted so a person can look at those first.

Method: each es/vi string is translated back to English and compared with our
English source (difflib similarity on normalised text). Low scores are flagged.

Reads GOOGLE_TRANSLATE_API_KEY from .env (never printed). Writes a report to
tasks/translation-check-<date>.md and the consent translations to
scripts/i18n/consent-translations.json. Read-only otherwise.

Usage:  python scripts/i18n/verify-translations.py
"""
import datetime
import difflib
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.stdout.reconfigure(encoding="utf-8")


def env_key() -> str:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("GOOGLE_TRANSLATE_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("GOOGLE_TRANSLATE_API_KEY not found in .env")


KEY = env_key()


def translate(texts: list[str], source: str, target: str) -> list[str]:
    out: list[str] = []
    for i in range(0, len(texts), 50):  # API takes up to 128 q per call; stay well under
        params = [("q", t) for t in texts[i:i + 50]] + [
            ("source", source), ("target", target), ("format", "text"), ("key", KEY)]
        req = urllib.request.Request(
            "https://translation.googleapis.com/language/translate/v2",
            data=urllib.parse.urlencode(params).encode(), method="POST")
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r)
        out += [t["translatedText"] for t in data["data"]["translations"]]
    return out


# ── 1. Collect the strings ─────────────────────────────────────────────────────
def flatten(d: dict, prefix: str = "") -> dict[str, str]:
    flat: dict[str, str] = {}
    for k, v in d.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            flat.update(flatten(v, key + "."))
        elif isinstance(v, str):
            flat[key] = v
    return flat


locales = {
    code: flatten(json.loads((ROOT / f"src/i18n/locales/{code}/translation.json").read_text(encoding="utf-8")))
    for code in ("en", "es", "vi")
}
# The features built this sprint (Get Support, consent line, intro video).
SCOPE = ("support.", "experts.introVideo.", "onboarding.consent.optional")
strings: dict[str, dict[str, str]] = {}
for key, en in locales["en"].items():
    if key.startswith(SCOPE) and key in locales["es"] and key in locales["vi"]:
        strings[f"ui:{key}"] = {"en": en, "es": locales["es"][key], "vi": locales["vi"][key]}

# Parent-facing email/crisis text inside the support-intake edge function.
fn = (ROOT / "supabase/functions/support-intake/index.ts").read_text(encoding="utf-8")


def ts_dict(name: str) -> dict[str, str]:
    block = re.search(rf"const {name}[^=]*=\s*(?:\([^)]*\)\s*=>\s*\()?\{{(.*?)\n\}}", fn, re.S).group(1)
    found: dict[str, str] = {}
    for lang in ("en", "es", "vi"):
        m = re.search(rf"\b{lang}:\s*(['\"`])(.*?)\1", block, re.S)
        if m:
            found[lang] = m.group(2)
    return found


for name in ("CRISIS_TEXT", "FALLBACK_EMPATHY", "CONFIRM_SUBJECT", "confirmText"):
    d = ts_dict(name)
    if len(d) == 3:
        strings[f"email:{name}"] = {k: v.replace("${name}", "Maya") for k, v in d.items()}

footer = re.search(r"const PARENT_FOOTER[^=]*=\s*\{(.*?)\n\}", fn, re.S).group(1)
per_lang = {lang: re.findall(r"'([^']+)'", re.search(rf"\b{lang}:\s*\[(.*?)\]", footer, re.S).group(1))
            for lang in ("en", "es", "vi")}
for i, en in enumerate(per_lang["en"]):
    strings[f"email:PARENT_FOOTER[{i}]"] = {"en": en, "es": per_lang["es"][i], "vi": per_lang["vi"][i]}

# ── 2. Back-translate and score ────────────────────────────────────────────────
def norm(s: str) -> str:
    s = re.sub(r"\{\{[^}]+\}\}", "X", s.lower())
    return re.sub(r"[^a-z0-9 ]+", " ", s).split().__str__()


keys = list(strings)
results = {}
for lang in ("es", "vi"):
    back = translate([strings[k][lang] for k in keys], lang, "en")
    for k, b in zip(keys, back):
        score = difflib.SequenceMatcher(None, norm(strings[k]["en"]), norm(b)).ratio()
        results.setdefault(k, {})[lang] = (b, score)

FLAG = 0.55  # below this, a human should read it; paraphrase alone usually stays above
flagged = [(k, lang) for k in keys for lang in ("es", "vi") if results[k][lang][1] < FLAG]

# ── 3. Consent wording → es/vi, with protected tokens ──────────────────────────
consent_en = {
    "email": "Yes, email me updates about my support requests, plus helpful tips and resources from Whisperoo. You can unsubscribe at any time.",
    "sms": "Yes, text me updates from Whisperoo about my support requests and account. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of using Whisperoo. See our [Terms](https://whisperoo.app/terms-and-conditions) and [Privacy Policy](https://whisperoo.app/privacy-policy).",
}
LINK_LABELS = {"es": ("Términos", "Política de Privacidad"), "vi": ("Điều khoản", "Chính sách Quyền riêng tư")}


def protect(text: str) -> tuple[str, dict[str, str]]:
    tokens = {}
    for i, word in enumerate(("Whisperoo", "STOP", "HELP")):
        if word in text:
            tokens[f"ZQX{i}"] = word
            text = text.replace(word, f"ZQX{i}")
    links = re.findall(r"\[([^\]]+)\]\(([^)]+)\)", text)
    for j, (_, url) in enumerate(links):
        tokens[f"ZQL{j}"] = url
        text = re.sub(r"\[[^\]]+\]\(" + re.escape(url) + r"\)", f"ZQL{j}", text, count=1)
    return text, tokens


consent_out = {}
for lang in ("es", "vi"):
    for channel, text in consent_en.items():
        masked, tokens = protect(text)
        t = translate([masked], "en", lang)[0]
        for tok, val in tokens.items():
            if tok.startswith("ZQL"):
                label = LINK_LABELS[lang][int(tok[3:])]
                t = t.replace(tok, f"[{label}]({val})")
            else:
                t = t.replace(tok, val)
        missing = [v for v in tokens.values() if v not in t and not v.startswith("http")]
        missing += [v for v in tokens.values() if v.startswith("http") and v not in t]
        back = translate([re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)], lang, "en")[0]
        consent_out[f"{channel}-{lang}"] = {"text": t, "back_translation": back, "missing_tokens": missing}

(ROOT / "scripts/i18n/consent-translations.json").write_text(
    json.dumps(consent_out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# ── 4. Report ──────────────────────────────────────────────────────────────────
today = datetime.date.today().isoformat()
lines = [f"# Translation check — {today}", "",
         "Method: Google back-translation (es/vi → en) compared with our English source.",
         f"Similarity below {FLAG} is flagged for a human read. Not a substitute for a",
         "bilingual review — it finds drift, not tone.", "",
         f"Checked **{len(keys)} strings × 2 languages**. Flagged: **{len(flagged)}**.", "",
         "## Flagged", ""]
if not flagged:
    lines.append("None.")
for k, lang in flagged:
    b, s = results[k][lang]
    lines += [f"- `{k}` ({lang}, {s:.2f})", f"  - EN source: {strings[k]['en']}",
              f"  - {lang}: {strings[k][lang]}", f"  - back to EN: {b}"]
lines += ["", "## Consent wording (machine-translated, client-authorised)", ""]
for k, v in consent_out.items():
    lines += [f"### {k}", "", v["text"], "", f"*Back to English:* {v['back_translation']}",
              f"*Protected tokens missing:* {', '.join(v['missing_tokens']) or 'none'}", ""]
lines += ["## All scores", "", "| string | es | vi |", "|---|---|---|"]
for k in keys:
    lines.append(f"| `{k}` | {results[k]['es'][1]:.2f} | {results[k]['vi'][1]:.2f} |")
report = ROOT / f"tasks/translation-check-{today}.md"
report.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"checked {len(keys)} strings x 2 languages; flagged {len(flagged)}")
print(f"report: {report.relative_to(ROOT)}")
print("consent: scripts/i18n/consent-translations.json")
