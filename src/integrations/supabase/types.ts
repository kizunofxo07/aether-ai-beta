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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      character_memory: {
        Row: {
          character_id: string
          created_at: string
          fact: string
          id: string
          source_session: string | null
        }
        Insert: {
          character_id: string
          created_at?: string
          fact: string
          id?: string
          source_session?: string | null
        }
        Update: {
          character_id?: string
          created_at?: string
          fact?: string
          id?: string
          source_session?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_memory_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          avatar_url: string | null
          category: string
          censorship_level: Database["public"]["Enums"]["censorship_level"]
          created_at: string
          description: string
          greeting: string
          id: string
          is_official: boolean
          is_owner_official: boolean
          is_remix_of: string | null
          name: string
          owner_id: string | null
          system_prompt: string
          tags: string[]
          visibility: Database["public"]["Enums"]["bot_visibility"]
        }
        Insert: {
          avatar_url?: string | null
          category?: string
          censorship_level?: Database["public"]["Enums"]["censorship_level"]
          created_at?: string
          description?: string
          greeting?: string
          id?: string
          is_official?: boolean
          is_owner_official?: boolean
          is_remix_of?: string | null
          name: string
          owner_id?: string | null
          system_prompt: string
          tags?: string[]
          visibility?: Database["public"]["Enums"]["bot_visibility"]
        }
        Update: {
          avatar_url?: string | null
          category?: string
          censorship_level?: Database["public"]["Enums"]["censorship_level"]
          created_at?: string
          description?: string
          greeting?: string
          id?: string
          is_official?: boolean
          is_owner_official?: boolean
          is_remix_of?: string | null
          name?: string
          owner_id?: string | null
          system_prompt?: string
          tags?: string[]
          visibility?: Database["public"]["Enums"]["bot_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "characters_is_remix_of_fkey"
            columns: ["is_remix_of"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          character_id: string
          created_at: string
          id: string
          session_id: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          session_id: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          session_id?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          background_color: string
          background_image_url: string | null
          created_at: string
          description: string
          display_name: string
          id: string
          is_public: boolean
          language_preference: string
          parental_enabled: boolean
          parental_password_hash: string | null
          parental_phone: string | null
          parental_phone_verified: boolean
          plan: Database["public"]["Enums"]["user_plan"]
          translation_enabled: boolean
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          background_color?: string
          background_image_url?: string | null
          created_at?: string
          description?: string
          display_name?: string
          id?: string
          is_public?: boolean
          language_preference?: string
          parental_enabled?: boolean
          parental_password_hash?: string | null
          parental_phone?: string | null
          parental_phone_verified?: boolean
          plan?: Database["public"]["Enums"]["user_plan"]
          translation_enabled?: boolean
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          background_color?: string
          background_image_url?: string | null
          created_at?: string
          description?: string
          display_name?: string
          id?: string
          is_public?: boolean
          language_preference?: string
          parental_enabled?: boolean
          parental_password_hash?: string | null
          parental_phone?: string | null
          parental_phone_verified?: boolean
          plan?: Database["public"]["Enums"]["user_plan"]
          translation_enabled?: boolean
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      remix_requests: {
        Row: {
          character_id: string
          created_at: string
          id: string
          message: string
          owner_id: string | null
          requester_id: string
          status: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          message?: string
          owner_id?: string | null
          requester_id: string
          status?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          message?: string
          owner_id?: string | null
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "remix_requests_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_content: {
        Row: {
          html: string
          id: string
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          html?: string
          id?: string
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          html?: string
          id?: string
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "moderator" | "staff" | "user"
      bot_visibility: "public" | "unlisted" | "private"
      censorship_level: "none" | "light" | "moderate" | "high" | "higher"
      user_plan: "free" | "nether"
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
      app_role: ["owner", "admin", "moderator", "staff", "user"],
      bot_visibility: ["public", "unlisted", "private"],
      censorship_level: ["none", "light", "moderate", "high", "higher"],
      user_plan: ["free", "nether"],
    },
  },
} as const
