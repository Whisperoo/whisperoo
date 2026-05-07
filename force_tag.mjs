import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function addTag() {
  const { data: prods, error: fetchErr } = await supabase.from('products').select('id, title').ilike('title', '%Consultation%').limit(2);
  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }
  if (!prods || prods.length === 0) {
    console.log('No products found to update.');
    return;
  }
  
  for (const p of prods) {
    const { error: updateErr } = await supabase.from('products').update({ tags: ['Baby Feeding', 'Fitness/yoga'] }).eq('id', p.id);
    if (updateErr) {
      console.error('Update error for', p.title, updateErr);
    } else {
      console.log('Successfully added tags to', p.title);
    }
  }
}

addTag();
