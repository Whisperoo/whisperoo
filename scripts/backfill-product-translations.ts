import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use service role key if available, otherwise fallback to anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY || process.env.VITE_GOOGLE_TRANSLATE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

if (!googleKey || googleKey === 'PLACEHOLDER') {
  console.error('Missing Google Translate API key. Please add it to .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function translate(text: string): Promise<{ es: string, vi: string }> {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${googleKey}`;
  const targets = ['es', 'vi'];
  
  const results: any = { es: text, vi: text };
  
  for (const target of targets) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: 'en',
          target,
          format: 'text',
        }),
      });
      
      const data = await response.json();
      if (data?.data?.translations?.[0]?.translatedText) {
        results[target] = data.data.translations[0].translatedText;
      }
    } catch (err) {
      console.error(`Failed to translate to ${target}:`, err);
    }
  }
  
  return results;
}

async function backfillProducts() {
  console.log('Starting product translation backfill...');

  const { data: products, error: fetchError } = await supabase
    .from('products')
    .select('id, title, description, title_es, description_es');

  if (fetchError) {
    console.error('Error fetching products:', fetchError);
    return;
  }

  if (!products || products.length === 0) {
    console.log('No products found to translate.');
    return;
  }

  console.log(`Found ${products.length} products. Processing...`);

  let successCount = 0;
  let errorCount = 0;

  for (const product of products) {
    console.log(`\nProcessing product: ${product.title} (${product.id})`);

    if (product.title_es && product.description_es && product.title_es.trim() !== '') {
      console.log('  -> Already translated. Skipping.');
      continue;
    }

    try {
      const updates: any = {};

      if (product.title && product.title.trim()) {
        const titleTrans = await translate(product.title);
        updates.title_es = titleTrans.es;
        updates.title_vi = titleTrans.vi;
        console.log(`  -> Translated title to ES/VI`);
      }

      if (product.description && product.description.trim()) {
        const descTrans = await translate(product.description);
        updates.description_es = descTrans.es;
        updates.description_vi = descTrans.vi;
        console.log(`  -> Translated description to ES/VI`);
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('products')
          .update(updates)
          .eq('id', product.id);

        if (updateError) {
          console.error(`  -> Failed to update product ${product.id}:`, updateError);
          errorCount++;
        } else {
          console.log(`  -> Successfully updated product ${product.id}`);
          successCount++;
        }
      } else {
        console.log('  -> No translatable content found.');
      }
    } catch (err) {
      console.error(`  -> Error processing product ${product.id}:`, err);
      errorCount++;
    }
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n=========================================');
  console.log('Backfill Complete!');
  console.log(`Successfully updated: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('=========================================');
}

backfillProducts().catch(console.error);
