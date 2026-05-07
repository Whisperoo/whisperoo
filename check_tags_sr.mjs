import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTags() {
  const { data, error } = await supabase.from('products').select('id, title, tags').not('tags', 'eq', '{}');
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }
  console.log(`Found ${data.length} products with tags (Bypassing RLS).`);
  data.forEach(p => {
    console.log(`Product: "${p.title}" | Tags:`, p.tags);
  });
}

checkTags();
