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
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
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
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
          thumbnail_url: string | null
          title: string
          total_files_count: number | null
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          expert_id?: string | null
          file_size_mb?: number | null
          file_url?: string | null
          has_multiple_files?: boolean | null
          id?: string
          is_active?: boolean | null
          page_count?: number | null
          price: number
          primary_file_url?: string | null
          product_type: string
          thumbnail_url?: string | null
          title: string
          total_files_count?: number | null
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          expert_id?: string | null
          file_size_mb?: number | null
          file_url?: string | null
          has_multiple_files?: boolean | null
          id?: string
          is_active?: boolean | null
          page_count?: number | null
          price?: number
          primary_file_url?: string | null
          product_type?: string
          thumbnail_url?: string | null
          title?: string
          total_files_count?: number | null
          updated_at?: string | null
          view_count?: number | null
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
          created_at: string | null
          custom_role: string | null
          email: string
          expecting_status:
            | Database["public"]["Enums"]["expecting_status"]
            | null
          expert_accepts_new_clients: boolean | null
          expert_availability_status: string | null
          expert_bio: string | null
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
          onboarded: boolean | null
          parenting_styles: string[]
          personal_context: string | null
          profile_image_url: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          topics_of_interest: string[]
          updated_at: string | null
        }
        Insert: {
          account_type?: string | null
          created_at?: string | null
          custom_role?: string | null
          email: string
          expecting_status?:
            | Database["public"]["Enums"]["expecting_status"]
            | null
          expert_accepts_new_clients?: boolean | null
          expert_availability_status?: string | null
          expert_bio?: string | null
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
          onboarded?: boolean | null
          parenting_styles?: string[]
          personal_context?: string | null
          profile_image_url?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          topics_of_interest?: string[]
          updated_at?: string | null
        }
        Update: {
          account_type?: string | null
          created_at?: string | null
          custom_role?: string | null
          email?: string
          expecting_status?:
            | Database["public"]["Enums"]["expecting_status"]
            | null
          expert_accepts_new_clients?: boolean | null
          expert_availability_status?: string | null
          expert_bio?: string | null
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
          onboarded?: boolean | null
          parenting_styles?: string[]
          personal_context?: string | null
          profile_image_url?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          topics_of_interest?: string[]
          updated_at?: string | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
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
        }[]
      }
      get_onboarding_progress: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_pregnancy_week: {
        Args: { due_date_input: string }
        Returns: number
      }
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
      get_weeks_until_due: {
        Args: { due_date_input: string }
        Returns: number
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
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