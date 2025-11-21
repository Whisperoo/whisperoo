// Script to generate embeddings for all experts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wznevejkaefokgibkknt.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable not set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function generateAllEmbeddings() {
  try {
    console.log('Calling generate_expert_embeddings function...')

    const { data, error } = await supabase.functions.invoke('generate_expert_embeddings', {
      body: { regenerate_all: true }
    })

    if (error) {
      console.error('Error generating embeddings:', error)
      return
    }

    console.log('Embeddings generation result:', data)

    // Verify the results
    const { data: embeddings, error: queryError } = await supabase
      .from('expert_embeddings')
      .select(`
        expert_id,
        profiles!inner(first_name, expert_specialties),
        created_at
      `)

    if (queryError) {
      console.error('Error querying embeddings:', queryError)
      return
    }

    console.log('\nCurrent embeddings in database:')
    embeddings.forEach(embedding => {
      console.log(`- ${embedding.profiles.first_name}: ${embedding.profiles.expert_specialties?.join(', ') || 'No specialties'}`)
    })

  } catch (error) {
    console.error('Script error:', error)
  }
}

generateAllEmbeddings()