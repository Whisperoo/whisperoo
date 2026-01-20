import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types based on our schema
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          first_name: string
          email: string
          role: 'mom' | 'dad' | 'caregiver' | 'other' | null
          custom_role: string | null
          expecting_status: 'yes' | 'no' | 'trying' | null
          has_kids: boolean | null
          kids_count: number | null
          onboarded: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          first_name: string
          email: string
          role?: 'mom' | 'dad' | 'caregiver' | 'other' | null
          custom_role?: string | null
          expecting_status?: 'yes' | 'no' | 'trying' | null
          has_kids?: boolean | null
          kids_count?: number | null
          onboarded?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          email?: string
          role?: 'mom' | 'dad' | 'caregiver' | 'other' | null
          custom_role?: string | null
          expecting_status?: 'yes' | 'no' | 'trying' | null
          has_kids?: boolean | null
          kids_count?: number | null
          onboarded?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      kids: {
        Row: {
          id: string
          parent_id: string
          age: string | null
          due_date: string | null
          is_expecting: boolean | null
          expected_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          parent_id: string
          age?: string | null
          due_date?: string | null
          is_expecting?: boolean | null
          expected_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          parent_id?: string
          age?: string | null
          due_date?: string | null
          is_expecting?: boolean | null
          expected_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // onboarding_steps table has been removed in favor of using profiles.onboarded boolean
    }
    Functions: {
      // Onboarding functions have been removed in favor of using profiles.onboarded boolean
    }
  }
}