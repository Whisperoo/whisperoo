export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      activity_files: {
        Row: {
          activity_id: string
          created_at: string
          display_order: number | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          display_order?: number | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          display_order?: number | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_files_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "course_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      care_checklist_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          kid_id: string
          template_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          kid_id: string
          template_id: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          kid_id?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_checklist_progress_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_checklist_progress_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "care_checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_checklist_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_checklist_templates: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          hospital_phone: string | null
          id: string
          is_universal: boolean | null
          sort_order: number | null
          stage: string
          stage_label: string
          tenant_id: string | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          hospital_phone?: string | null
          id?: string
          is_universal?: boolean | null
          sort_order?: number | null
          stage: string
          stage_label: string
          tenant_id?: string | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          hospital_phone?: string | null
          id?: string
          is_universal?: boolean | null
          sort_order?: number | null
          stage?: string
          stage_label?: string
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_checklist_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_training: {
        Row: {
          ai_response: string
          classification: string
          created_at: string | null
          embedding: string | null
          id: string
          status: string | null
          tester_id: string | null
          user_query: string
        }
        Insert: {
          ai_response: string
          classification: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          status?: string | null
          tester_id?: string | null
          user_query: string
        }
        Update: {
          ai_response?: string
          classification?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          status?: string | null
          tester_id?: string | null
          user_query?: string
        }
        Relationships: []
      }
      course_activities: {
        Row: {
          activity_order: number
          activity_type: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          session_id: string
          title: string
          updated_at: string
        }
        Insert: {
          activity_order: number
          activity_type?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          session_id: string
          title: string
          updated_at?: string
        }
        Update: {
          activity_order?: number
          activity_type?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          session_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_activities_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sessions: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          session_order: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          session_order: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          session_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          id: string
          product_id: string
          total_duration_minutes: number | null
          total_sessions: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          total_duration_minutes?: number | null
          total_sessions?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          total_duration_minutes?: number | null
          total_sessions?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_bookings: {
        Row: {
          id: string
          user_id: string
          user_email: string
          user_name: string
          expert_id: string
          expert_name: string
          product_id: string
          appointment_name: string
          booking_type: string
          amount_paid: number | null
          purchase_id: string | null
          resource_type: string
          status: string
          booked_at: string
          completed_at: string | null
          cancelled_at: string | null
          discount_code: string | null
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          user_email: string
          user_name: string
          expert_id: string
          expert_name: string
          product_id: string
          appointment_name: string
          booking_type: string
          amount_paid?: number | null
          purchase_id?: string | null
          resource_type?: string
          status?: string
          booked_at?: string
          completed_at?: string | null
          cancelled_at?: string | null
          discount_code?: string | null
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          user_email?: string
          user_name?: string
          expert_id?: string
          expert_name?: string
          product_id?: string
          appointment_name?: string
          booking_type?: string
          amount_paid?: number | null
          purchase_id?: string | null
          resource_type?: string
          status?: string
          booked_at?: string
          completed_at?: string | null
          cancelled_at?: string | null
          discount_code?: string | null
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_bookings_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_bookings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_embeddings: {
        Row: {
          created_at: string | null
          embedding: string | null
          expert_id: string
          id: string
          profile_text: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          expert_id: string
          id?: string
          profile_text: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          expert_id?: string
          id?: string
          profile_text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_embeddings_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kids: {
        Row: {
          age: string | null
          birth_date: string | null
          created_at: string | null
          due_date: string | null
          expected_name: string | null
          first_name: string | null
          id: string
          is_expecting: boolean | null
          parent_id: string
          updated_at: string | null
        }
        Insert: {
          age?: string | null
          birth_date?: string | null
          created_at?: string | null
          due_date?: string | null
          expected_name?: string | null
          first_name?: string | null
          id?: string
          is_expecting?: boolean | null
          parent_id: string
          updated_at?: string | null
        }
        Update: {
          age?: string | null
          birth_date?: string | null
          created_at?: string | null
          due_date?: string | null
          expected_name?: string | null
          first_name?: string | null
          id?: string
          is_expecting?: boolean | null
          parent_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_flagged_for_review: boolean | null
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_flagged_for_review?: boolean | null
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_flagged_for_review?: boolean | null
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_analytics: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          ip_address: unknown
          product_id: string | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          product_id?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          product_id?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_analytics_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      product_category_mappings: {
        Row: {
          category_id: string
          product_id: string
        }
        Insert: {
          category_id: string
          product_id: string
        }
        Update: {
          category_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_files: {
        Row: {
          created_at: string
          description: string | null
          display_title: string | null
          duration_minutes: number | null
          file_name: string
          file_size_mb: number | null
          file_type: string
          file_url: string
          id: string
          is_primary: boolean | null
          mime_type: string | null
          page_count: number | null
          product_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_title?: string | null
          duration_minutes?: number | null
          file_name: string
          file_size_mb?: number | null
          file_type: string
          file_url: string
          id?: string
          is_primary?: boolean | null
          mime_type?: string | null
          page_count?: number | null
          product_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_title?: string | null
          duration_minutes?: number | null
          file_name?: string
          file_size_mb?: number | null
          file_type?: string
          file_url?: string
          id?: string
          is_primary?: boolean | null
          mime_type?: string | null
          page_count?: number | null
          product_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_files_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          created_at: string | null
          id: string
          is_verified_purchase: boolean | null
          product_id: string | null
          rating: number | null
          review_text: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_verified_purchase?: boolean | null
          product_id?: string | null
          rating?: number | null
          review_text?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_verified_purchase?: boolean | null
          product_id?: string | null
          rating?: number | null
          review_text?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          booking_model: string | null
          content_type: string | null
          created_at: string | null
          description: string | null
          description_es: string | null
          description_vi: string | null
          duration_minutes: number | null
          expert_id: string | null
          file_size_mb: number | null
          file_url: string | null
          has_multiple_files: boolean | null
          how_to_schedule: string | null
          hospital_prebook_message: string | null
          id: string
          is_active: boolean | null
          page_count: number | null
          price: number
          primary_file_url: string | null
          product_type: string
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          title_es: string | null
          title_vi: string | null
          total_files_count: number | null
          updated_at: string | null
          view_count: number | null
          tenant_id: string | null
          is_hospital_resource: boolean | null
        }
        Insert: {
          booking_model?: string | null
          content_type?: string | null
          created_at?: string | null
          description?: string | null
          description_es?: string | null
          description_vi?: string | null
          duration_minutes?: number | null
          expert_id?: string | null
          file_size_mb?: number | null
          file_url?: string | null
          has_multiple_files?: boolean | null
          how_to_schedule?: string | null
          hospital_prebook_message?: string | null
          id?: string
          is_active?: boolean | null
          page_count?: number | null
          price: number
          primary_file_url?: string | null
          product_type: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          title_es?: string | null
          title_vi?: string | null
          total_files_count?: number | null
          updated_at?: string | null
          view_count?: number | null
          tenant_id?: string | null
          is_hospital_resource?: boolean | null
        }
        Update: {
          booking_model?: string | null
          content_type?: string | null
          created_at?: string | null
          description?: string | null
          description_es?: string | null
          description_vi?: string | null
          duration_minutes?: number | null
          expert_id?: string | null
          file_size_mb?: number | null
          file_url?: string | null
          has_multiple_files?: boolean | null
          how_to_schedule?: string | null
          hospital_prebook_message?: string | null
          id?: string
          is_active?: boolean | null
          page_count?: number | null
          price?: number
          primary_file_url?: string | null
          product_type?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          title_es?: string | null
          title_vi?: string | null
          total_files_count?: number | null
          updated_at?: string | null
          view_count?: number | null
          tenant_id?: string | null
          is_hospital_resource?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "products_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string | null
          acquisition_source: string | null
          created_at: string | null
          custom_role: string | null
          email: string
          expecting_status:
            | Database["public"]["Enums"]["expecting_status"]
            | null
          expert_accepts_new_clients: boolean | null
          expert_availability_status: string | null
          expert_bio: string | null
          expert_bio_es: string | null
          expert_bio_vi: string | null
          expert_certifications_verified: boolean | null
          expert_consultation_rate: number | null
          expert_consultation_types: string[] | null
          expert_credentials: string[] | null
          expert_education: string[] | null
          expert_experience_years: number | null
          expert_languages: string[] | null
          expert_office_location: string | null
          expert_profile_visibility: boolean | null
          expert_rating: number | null
          expert_response_time_hours: number | null
          expert_social_links: Json | null
          expert_specialties: string[] | null
          expert_timezone: string | null
          expert_total_reviews: number | null
          expert_verification_documents: Json | null
          expert_verified: boolean | null
          expert_website_url: string | null
          first_name: string
          has_kids: boolean | null
          id: string
          kids_count: number | null
          language_preference: string | null
          onboarded: boolean | null
          parenting_styles: string[]
          personal_context: string | null
          phone: string | null
          phone_number: string | null
          preferred_language: string | null
          profile_image_url: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          tenant_id: string | null
          inquiry_confirmation_message: string | null
          inquiry_prebook_message: string | null
          topics_of_interest: string[]
          updated_at: string | null
        }
        Insert: {
          account_type?: string | null
          acquisition_source?: string | null
          created_at?: string | null
          custom_role?: string | null
          email: string
          expecting_status?:
            | Database["public"]["Enums"]["expecting_status"]
            | null
          expert_accepts_new_clients?: boolean | null
          expert_availability_status?: string | null
          expert_bio?: string | null
          expert_bio_es?: string | null
          expert_bio_vi?: string | null
          expert_certifications_verified?: boolean | null
          expert_consultation_rate?: number | null
          expert_consultation_types?: string[] | null
          expert_credentials?: string[] | null
          expert_education?: string[] | null
          expert_experience_years?: number | null
          expert_languages?: string[] | null
          expert_office_location?: string | null
          expert_profile_visibility?: boolean | null
          expert_rating?: number | null
          expert_response_time_hours?: number | null
          expert_social_links?: Json | null
          expert_specialties?: string[] | null
          expert_timezone?: string | null
          expert_total_reviews?: number | null
          expert_verification_documents?: Json | null
          expert_verified?: boolean | null
          expert_website_url?: string | null
          first_name: string
          has_kids?: boolean | null
          id: string
          kids_count?: number | null
          language_preference?: string | null
          onboarded?: boolean | null
          parenting_styles?: string[]
          personal_context?: string | null
          phone?: string | null
          phone_number?: string | null
          preferred_language?: string | null
          profile_image_url?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          tenant_id?: string | null
          inquiry_confirmation_message?: string | null
          inquiry_prebook_message?: string | null
          topics_of_interest?: string[]
          updated_at?: string | null
        }
        Update: {
          account_type?: string | null
          acquisition_source?: string | null
          created_at?: string | null
          custom_role?: string | null
          email?: string
          expecting_status?:
            | Database["public"]["Enums"]["expecting_status"]
            | null
          expert_accepts_new_clients?: boolean | null
          expert_availability_status?: string | null
          expert_bio?: string | null
          expert_bio_es?: string | null
          expert_bio_vi?: string | null
          expert_certifications_verified?: boolean | null
          expert_consultation_rate?: number | null
          expert_consultation_types?: string[] | null
          expert_credentials?: string[] | null
          expert_education?: string[] | null
          expert_experience_years?: number | null
          expert_languages?: string[] | null
          expert_office_location?: string | null
          expert_profile_visibility?: boolean | null
          expert_rating?: number | null
          expert_response_time_hours?: number | null
          expert_social_links?: Json | null
          expert_specialties?: string[] | null
          expert_timezone?: string | null
          expert_total_reviews?: number | null
          expert_verification_documents?: Json | null
          expert_verified?: boolean | null
          expert_website_url?: string | null
          first_name?: string
          has_kids?: boolean | null
          id?: string
          kids_count?: number | null
          language_preference?: string | null
          onboarded?: boolean | null
          parenting_styles?: string[]
          personal_context?: string | null
          phone?: string | null
          phone_number?: string | null
          preferred_language?: string | null
          profile_image_url?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          tenant_id?: string | null
          inquiry_confirmation_message?: string | null
          inquiry_prebook_message?: string | null
          topics_of_interest?: string[]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          access_expires_at: string | null
          amount: number
          consultation_completed: boolean | null
          consultation_completed_at: string | null
          currency: string | null
          expert_id: string | null
          id: string
          metadata: Json | null
          payment_intent_id: string | null
          payment_method: string | null
          product_id: string | null
          purchased_at: string | null
          status: string | null
          discount_code: string | null
          user_id: string | null
        }
        Insert: {
          access_expires_at?: string | null
          amount: number
          consultation_completed?: boolean | null
          consultation_completed_at?: string | null
          currency?: string | null
          expert_id?: string | null
          id?: string
          metadata?: Json | null
          payment_intent_id?: string | null
          payment_method?: string | null
          product_id?: string | null
          purchased_at?: string | null
          status?: string | null
          discount_code?: string | null
          user_id?: string | null
        }
        Update: {
          access_expires_at?: string | null
          amount?: number
          consultation_completed?: boolean | null
          consultation_completed_at?: string | null
          currency?: string | null
          expert_id?: string | null
          id?: string
          metadata?: Json | null
          payment_intent_id?: string | null
          payment_method?: string | null
          product_id?: string | null
          purchased_at?: string | null
          status?: string | null
          discount_code?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          child_id: string | null
          created_at: string | null
          id: string
          is_active: boolean
          last_message_at: string | null
          summary: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          last_message_at?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          last_message_at?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_ai_audit_trail: {
        Row: {
          category: string | null
          cohort: string | null
          created_at: string | null
          escalation: boolean | null
          message_id: string | null
          metadata: Json | null
          summary: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_monthly_enrollment: {
        Row: {
          enrolled_count: number | null
          month_date: string | null
          month_label: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_monthly_escalation: {
        Row: {
          escalation_pct: number | null
          flagged_count: number | null
          month_date: string | null
          month_label: string | null
          tenant_id: string | null
          total_messages: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      flagged_messages_view: {
        Row: {
          content: string | null
          created_at: string | null
          id: string | null
          is_flagged_for_review: boolean | null
          metadata: Json | null
          role: string | null
          session_id: string | null
          tenant_id: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      complete_onboarding_step: {
        Args: { step_data?: Json; step_name: string }
        Returns: undefined
      }
      find_similar_experts: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          expert_bio: string
          expert_consultation_rate: number
          expert_credentials: string[]
          expert_experience_years: number
          expert_id: string
          expert_office_location: string
          expert_rating: number
          expert_specialties: string[]
          expert_total_reviews: number
          first_name: string
          profile_image_url: string
          similarity: number
          tenant_id: string
        }[]
      }
      fn_get_admin_dashboard: { Args: { p_tenant_id?: string }; Returns: Json }
      get_onboarding_progress: { Args: never; Returns: Json }
      get_pregnancy_week: { Args: { due_date_input: string }; Returns: number }
      get_product_files: {
        Args: { product_uuid: string }
        Returns: {
          description: string
          duration_minutes: number
          file_name: string
          file_size_mb: number
          file_type: string
          file_url: string
          id: string
          is_primary: boolean
          page_count: number
          sort_order: number
        }[]
      }
      get_user_tenant_id: { Args: never; Returns: string }
      get_weeks_until_due: { Args: { due_date_input: string }; Returns: number }
      match_compliance_training: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          ai_response: string
          classification: string
          id: string
          similarity: number
          user_query: string
        }[]
      }
      search_products_with_experts: {
        Args: { search_term: string }
        Returns: {
          content_type: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          expert_id: string | null
          file_size_mb: number | null
          file_url: string | null
          has_multiple_files: boolean | null
          id: string
          is_active: boolean | null
          page_count: number | null
          price: number
          primary_file_url: string | null
          product_type: string
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          total_files_count: number | null
          updated_at: string | null
          view_count: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      expecting_status: "yes" | "no" | "trying"
      user_role: "mom" | "dad" | "caregiver" | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      expecting_status: ["yes", "no", "trying"],
      user_role: ["mom", "dad", "caregiver", "other"],
    },
  },
} as const
