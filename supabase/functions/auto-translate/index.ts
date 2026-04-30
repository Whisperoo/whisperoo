// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * auto-translate Edge Function
 * 
 * Called by database triggers (via pg_net) whenever translatable content
 * is inserted or updated. Translates specified fields from English to
 * Spanish (es) and Vietnamese (vi) using Google Cloud Translation API.
 * 
 * Payload shape:
 * {
 *   table: "products" | "care_checklist_templates" | "profiles",
 *   record_id: "uuid",
 *   fields: [
 *     { source: "title", targets: { es: "title_es", vi: "title_vi" } },
 *     { source: "description", targets: { es: "description_es", vi: "description_vi" } }
 *   ]
 * }
 */

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_TRANSLATE_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

interface TranslateField {
  source: string
  targets: { es: string; vi: string }
}

interface TranslatePayload {
  table: string
  record_id: string
  fields: TranslateField[]
}

/**
 * Translate text using Google Cloud Translation API v2
 */
async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || !text.trim()) return ''
  if (!GOOGLE_API_KEY) {
    console.warn('GOOGLE_TRANSLATE_API_KEY not set — skipping translation')
    return ''
  }

  const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: 'en',
      target: targetLang,
      format: 'text'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`Translation API error (${targetLang}):`, error)
    return ''
  }

  const data = await response.json()
  return data?.data?.translations?.[0]?.translatedText || ''
}

Deno.serve(async (req) => {
  // Only accept POST
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const payload: TranslatePayload = await req.json()
    const { table, record_id, fields } = payload

    if (!table || !record_id || !fields?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: table, record_id, fields' }),
        { status: 400 }
      )
    }

    // Use service role key to bypass RLS (this is a server-to-server call)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 1. Fetch the current record to get source text
    const { data: record, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .eq('id', record_id)
      .single()

    if (fetchError || !record) {
      console.error('Failed to fetch record:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Record not found', details: fetchError }),
        { status: 404 }
      )
    }

    // 2. Translate each field to es and vi
    const updates: Record<string, string> = {}

    for (const field of fields) {
      const sourceText = record[field.source]
      if (!sourceText || typeof sourceText !== 'string') continue

      // Only translate if target column is currently empty
      if (!record[field.targets.es]) {
        const esText = await translateText(sourceText, 'es')
        if (esText) updates[field.targets.es] = esText
      }

      if (!record[field.targets.vi]) {
        const viText = await translateText(sourceText, 'vi')
        if (viText) updates[field.targets.vi] = viText
      }
    }

    // 3. Update the record with translations (if any)
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from(table)
        .update(updates)
        .eq('id', record_id)

      if (updateError) {
        console.error('Failed to update translations:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to save translations', details: updateError }),
          { status: 500 }
        )
      }

      console.log(`✅ Translated ${Object.keys(updates).length} fields for ${table}/${record_id}`)
    } else {
      console.log(`⏭️ No translations needed for ${table}/${record_id}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        translated_fields: Object.keys(updates),
        record_id 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('auto-translate error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
