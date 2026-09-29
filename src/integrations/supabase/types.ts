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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invite_status"]
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Relationships: [
          {
            foreignKeyName: "allowed_emails_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json | null
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          granted: boolean
          granted_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          granted?: boolean
          granted_at?: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          granted?: boolean
          granted_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          description: string | null
          id: string
          phase_id: string
          position: number
          title: string
        }
        Insert: {
          description?: string | null
          id?: string
          phase_id: string
          position?: number
          title: string
        }
        Update: {
          description?: string | null
          id?: string
          phase_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string
          current_month: number
          id: string
          mentee_id: string
          mentor_id: string | null
          program_id: string
          progress_pct: number
          started_at: string
        }
        Insert: {
          created_at?: string
          current_month?: number
          id?: string
          mentee_id: string
          mentor_id?: string | null
          program_id: string
          progress_pct?: number
          started_at?: string
        }
        Update: {
          created_at?: string
          current_month?: number
          id?: string
          mentee_id?: string
          mentor_id?: string | null
          program_id?: string
          progress_pct?: number
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_mentee_id_fkey"
            columns: ["mentee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          enrollment_id: string
          id: string
          lesson_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          enrollment_id: string
          id?: string
          lesson_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          enrollment_id?: string
          id?: string
          lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          kind: Database["public"]["Enums"]["content_kind"]
          media_url: string | null
          phase_id: string
          position: number
          subtitle: string | null
          title: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["content_kind"]
          media_url?: string | null
          phase_id: string
          position?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["content_kind"]
          media_url?: string | null
          phase_id?: string
          position?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          description: string | null
          duration_minutes: number | null
          enrollment_id: string | null
          id: string
          join_url: string | null
          kind: Database["public"]["Enums"]["meeting_kind"]
          scheduled_at: string
          title: string
        }
        Insert: {
          description?: string | null
          duration_minutes?: number | null
          enrollment_id?: string | null
          id?: string
          join_url?: string | null
          kind?: Database["public"]["Enums"]["meeting_kind"]
          scheduled_at: string
          title: string
        }
        Update: {
          description?: string | null
          duration_minutes?: number | null
          enrollment_id?: string | null
          id?: string
          join_url?: string | null
          kind?: Database["public"]["Enums"]["meeting_kind"]
          scheduled_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          enrollment_id: string
          id: string
          lesson_id: string | null
          visibility: Database["public"]["Enums"]["note_visibility"]
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          enrollment_id: string
          id?: string
          lesson_id?: string | null
          visibility?: Database["public"]["Enums"]["note_visibility"]
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          lesson_id?: string | null
          visibility?: Database["public"]["Enums"]["note_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      phases: {
        Row: {
          description: string | null
          id: string
          month_number: number
          pillar: string
          program_id: string
          title: string
        }
        Insert: {
          description?: string | null
          id?: string
          month_number: number
          pillar: string
          program_id: string
          title: string
        }
        Update: {
          description?: string | null
          id?: string
          month_number?: number
          pillar?: string
          program_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "phases_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          claimed: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          pillar: string | null
          title: string | null
        }
        Insert: {
          avatar_url?: string | null
          claimed?: boolean
          created_at?: string
          email: string
          full_name: string
          id?: string
          pillar?: string | null
          title?: string | null
        }
        Update: {
          avatar_url?: string | null
          claimed?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          pillar?: string | null
          title?: string | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string
          description: string | null
          duration_months: number
          id: string
          name: string
          tagline: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_months?: number
          id?: string
          name: string
          tagline?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_months?: number
          id?: string
          name?: string
          tagline?: string | null
        }
        Relationships: []
      }
      rise90_goals: {
        Row: {
          created_at: string
          current_value: number
          enrollment_id: string
          horizon: string | null
          id: string
          metric: string | null
          target_value: number | null
          title: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          enrollment_id: string
          horizon?: string | null
          id?: string
          metric?: string | null
          target_value?: number | null
          title: string
        }
        Update: {
          created_at?: string
          current_value?: number
          enrollment_id?: string
          horizon?: string | null
          id?: string
          metric?: string | null
          target_value?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rise90_goals_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          content: string | null
          deliverable_id: string
          enrollment_id: string
          id: string
          status: Database["public"]["Enums"]["submission_status"]
          updated_at: string
        }
        Insert: {
          content?: string | null
          deliverable_id: string
          enrollment_id: string
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          updated_at?: string
        }
        Update: {
          content?: string | null
          deliverable_id?: string
          enrollment_id?: string
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
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
      can_access_enrollment: {
        Args: { _enrollment_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_enrollment_mentee: {
        Args: { _enrollment_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "mentor" | "mentee"
      content_kind: "aula" | "atividade" | "encontro" | "material"
      invite_status: "approved" | "revoked"
      meeting_kind: "grupo" | "individual"
      note_visibility: "mentee_private" | "mentor_private" | "shared"
      submission_status:
        | "nao_iniciada"
        | "em_andamento"
        | "enviada"
        | "em_revisao"
        | "concluida"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "mentor", "mentee"],
      content_kind: ["aula", "atividade", "encontro", "material"],
      invite_status: ["approved", "revoked"],
      meeting_kind: ["grupo", "individual"],
      note_visibility: ["mentee_private", "mentor_private", "shared"],
      submission_status: [
        "nao_iniciada",
        "em_andamento",
        "enviada",
        "em_revisao",
        "concluida",
      ],
    },
  },
} as const
