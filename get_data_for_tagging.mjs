import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getData() {
  const { data: products } = await supabase.from('products').select('id, title, description');
  const { data: experts } = await supabase.from('profiles').select('id, first_name, expert_specialties').not('expert_specialties', 'is', null);

  console.log('--- PRODUCTS ---');
  products?.forEach(p => console.log(`${p.id}|${p.title}`));
  console.log('--- EXPERTS ---');
  experts?.forEach(e => console.log(`${e.id}|${e.first_name}|${JSON.stringify(e.expert_specialties)}`));
}

getData();
