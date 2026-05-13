import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Parse .env file manually
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) env[match[1]] = match[2].trim();
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_TRANSLATE_API_KEY = env.GOOGLE_TRANSLATE_API_KEY || env.VITE_GOOGLE_TRANSLATE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';
const TARGET_LANGUAGES = ['es', 'vi'];

async function translateText(text: string): Promise<{ es: string; vi: string }> {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    throw new Error("Missing GOOGLE_TRANSLATE_API_KEY");
  }

  const requests = TARGET_LANGUAGES.map((target) =>
    fetch(`${GOOGLE_TRANSLATE_URL}?key=${GOOGLE_TRANSLATE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'en',
        target,
        format: 'text',
      }),
    }).then((r) => r.json() as any)
  );

  const [esResponse, viResponse] = await Promise.all(requests);

  return {
    es: esResponse?.data?.translations?.[0]?.translatedText ?? text,
    vi: viResponse?.data?.translations?.[0]?.translatedText ?? text,
  };
}

async function runBackfill() {
  console.log("🚀 Starting expert bio translation backfill...");

  // Fetch all verified experts who have a bio but are missing Spanish translation
  const { data: experts, error } = await supabase
    .from('profiles')
    .select('id, first_name, expert_bio')
    .eq('account_type', 'expert')
    .not('expert_bio', 'is', null)
    .is('expert_bio_es', null);

  if (error) {
    console.error("❌ Error fetching experts:", error);
    process.exit(1);
  }

  if (!experts || experts.length === 0) {
    console.log("✅ No experts need translation. Everyone is up to date!");
    process.exit(0);
  }

  console.log(`Found ${experts.length} expert(s) needing translation.`);

  for (const expert of experts) {
    if (!expert.expert_bio) continue;

    console.log(`Translating bio for ${expert.first_name || expert.id}...`);
    try {
      const translated = await translateText(expert.expert_bio);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          expert_bio_es: translated.es,
          expert_bio_vi: translated.vi
        })
        .eq('id', expert.id);

      if (updateError) {
        console.error(`❌ Failed to update ${expert.first_name}:`, updateError);
      } else {
        console.log(`✅ Successfully translated and updated ${expert.first_name}`);
      }
    } catch (err) {
      console.error(`❌ Error translating for ${expert.first_name}:`, err);
    }
  }

  console.log("🎉 Backfill complete!");
}

runBackfill();
