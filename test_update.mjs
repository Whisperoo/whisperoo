import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testUpdate() {
  const { data: prods } = await supabase.from('products').select('id, title').limit(1);
  if (!prods || prods.length === 0) return;
  const id = prods[0].id;
  
  const { error } = await supabase.from('products').update({ tags: ['Baby Feeding'] }).eq('id', id);
  if (error) {
    console.error('Error updating:', error);
  } else {
    console.log('Update successful!');
    const { data } = await supabase.from('products').select('id, title, tags').eq('id', id);
    console.log('Verification:', data);
  }
}

testUpdate();
