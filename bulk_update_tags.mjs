import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CANONICAL_TAGS = [
  'Baby Feeding',
  'Pelvic Floor',
  'Sleep Coaching',
  'Nervous System Regulation',
  'Nutrition',
  'Pediatric Dentistry',
  'Lifestyle Coaching',
  'Fitness/yoga',
  'Back to Work',
  'Postpartum Tips',
  'Prenatal Tips'
];

async function updateTags() {
  const { data: products } = await supabase.from('products').select('id, title, description');
  const { data: experts } = await supabase.from('profiles').select('id, first_name, expert_specialties').not('expert_specialties', 'is', null);

  console.log('Updating products...');
  for (const p of products || []) {
    const tags = new Set();
    const text = (p.title + ' ' + (p.description || '')).toLowerCase();

    if (text.includes('sleep') || text.includes('nap')) tags.add('Sleep Coaching');
    if (text.includes('nourish') || text.includes('recipe') || text.includes('eat') || text.includes('snack') || text.includes('hunger') || text.includes('fullness')) tags.add('Nutrition');
    if (text.includes('postpartum') || text.includes('postnatal') || text.includes('recovery')) tags.add('Postpartum Tips');
    if (text.includes('pregnancy') || text.includes('prenatal') || text.includes('labor') || text.includes('birth') || text.includes('expecting')) tags.add('Prenatal Tips');
    if (text.includes('pelvic') || text.includes('core')) tags.add('Pelvic Floor');
    if (text.includes('feeding') || text.includes('breastfeeding') || text.includes('lactation') || text.includes('pacifier') || text.includes('weaning')) tags.add('Baby Feeding');
    if (text.includes('nervous system') || text.includes('hormone') || text.includes('body image') || text.includes('anxiety')) tags.add('Nervous System Regulation');
    if (text.includes('dentist') || text.includes('oral') || text.includes('teething')) tags.add('Pediatric Dentistry');
    if (text.includes('lifestyle') || text.includes('coaching') || text.includes('travel') || text.includes('dynamics')) tags.add('Lifestyle Coaching');
    if (text.includes('back to work') || text.includes('maternity leave') || text.includes('working mom')) tags.add('Back to Work');
    if (text.includes('fitness') || text.includes('yoga') || text.includes('stability ball') || text.includes('core')) tags.add('Fitness/yoga');

    const finalTags = Array.from(tags);
    if (finalTags.length > 0) {
      await supabase.from('products').update({ tags: finalTags }).eq('id', p.id);
      console.log(`Updated product: ${p.title} -> ${finalTags.join(', ')}`);
    }
  }

  console.log('Updating experts...');
  for (const e of experts || []) {
    const tags = new Set(e.expert_specialties || []);
    const specialtiesText = (e.expert_specialties || []).join(' ').toLowerCase();

    if (specialtiesText.includes('sleep')) tags.add('Sleep Coaching');
    if (specialtiesText.includes('dietitian') || specialtiesText.includes('eating') || specialtiesText.includes('nutrition')) tags.add('Nutrition');
    if (specialtiesText.includes('pelvic')) tags.add('Pelvic Floor');
    if (specialtiesText.includes('nervous') || specialtiesText.includes('hormone')) tags.add('Nervous System Regulation');
    if (specialtiesText.includes('breastfeeding') || specialtiesText.includes('ibclc')) tags.add('Baby Feeding');
    if (specialtiesText.includes('maternity') || specialtiesText.includes('back to work')) tags.add('Back to Work');
    if (specialtiesText.includes('lifestyle') || specialtiesText.includes('coaching') || specialtiesText.includes('behavioral') || specialtiesText.includes('child development')) tags.add('Lifestyle Coaching');
    if (specialtiesText.includes('dentist') || specialtiesText.includes('oral')) tags.add('Pediatric Dentistry');
    if (specialtiesText.includes('newborn care')) tags.add('Postpartum Tips');

    const finalTags = Array.from(tags);
    if (finalTags.length !== e.expert_specialties.length) {
      await supabase.from('profiles').update({ expert_specialties: finalTags }).eq('id', e.id);
      console.log(`Updated expert: ${e.first_name} -> ${finalTags.join(', ')}`);
    }
  }
  
  console.log('Done!');
}

updateTags();
