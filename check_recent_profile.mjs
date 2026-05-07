import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRecentProfile() {
  const { data, error } = await supabase.from('profiles').select('id, first_name, topics_of_interest, created_at').order('created_at', { ascending: false }).limit(1);
  if (error) {
    console.error(error);
    return;
  }
  console.log('Most recent profile:', data[0]);
}

checkRecentProfile();
