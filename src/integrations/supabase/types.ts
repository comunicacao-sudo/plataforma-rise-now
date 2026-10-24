export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          invited_by: string | null;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["invite_status"];
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id?: string;
          invited_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["invite_status"];
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          invited_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["invite_status"];
        };
        Relationships: [
          {
            foreignKeyName: "allowed_emails_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string;
          connector_id: string;
          created_at: string;
          id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          connection_key_ciphertext: string;
          connector_id: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          connection_key_ciphertext?: string;
          connector_id?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      assessment_ai_outputs: {
        Row: {
          attempt_id: string;
          audience: string;
          authorized_sections: Json;
          created_at: string;
          evidence_ids: Json;
          generated_at: string | null;
          id: string;
          output: Json | null;
          prompt_version: string;
          status: string;
        };
        Insert: {
          attempt_id: string;
          audience: string;
          authorized_sections?: Json;
          created_at?: string;
          evidence_ids?: Json;
          generated_at?: string | null;
          id?: string;
          output?: Json | null;
          prompt_version: string;
          status?: string;
        };
        Update: {
          attempt_id?: string;
          audience?: string;
          authorized_sections?: Json;
          created_at?: string;
          evidence_ids?: Json;
          generated_at?: string | null;
          id?: string;
          output?: Json | null;
          prompt_version?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_ai_outputs_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "assessment_attempts";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_attempts: {
        Row: {
          assessment_version: string;
          calculated_at: string | null;
          calculated_result: Json | null;
          completed_at: string | null;
          current_index: number;
          enrollment_id: string;
          id: string;
          mentee_id: string;
          prompt_version: string;
          released_at: string | null;
          released_by: string | null;
          report_status: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          scoring_version: string;
          started_at: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          assessment_version: string;
          calculated_at?: string | null;
          calculated_result?: Json | null;
          completed_at?: string | null;
          current_index?: number;
          enrollment_id: string;
          id?: string;
          mentee_id: string;
          prompt_version: string;
          released_at?: string | null;
          released_by?: string | null;
          report_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          scoring_version: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          assessment_version?: string;
          calculated_at?: string | null;
          calculated_result?: Json | null;
          completed_at?: string | null;
          current_index?: number;
          enrollment_id?: string;
          id?: string;
          mentee_id?: string;
          prompt_version?: string;
          released_at?: string | null;
          released_by?: string | null;
          report_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          scoring_version?: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_attempts_mentee_id_fkey";
            columns: ["mentee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_attempts_released_by_fkey";
            columns: ["released_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_attempts_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_development_plans: {
        Row: {
          action: string;
          attempt_id: string;
          created_at: string;
          created_by: string;
          due_date: string | null;
          enrollment_id: string;
          id: string;
          objective: string;
          observations: string | null;
          priority_focus: string;
          progress_evidence: string | null;
          responsible: string | null;
          review_date: string | null;
          shared_with_mentee: boolean;
          status: string;
          updated_at: string;
        };
        Insert: {
          action: string;
          attempt_id: string;
          created_at?: string;
          created_by: string;
          due_date?: string | null;
          enrollment_id: string;
          id?: string;
          objective: string;
          observations?: string | null;
          priority_focus: string;
          progress_evidence?: string | null;
          responsible?: string | null;
          review_date?: string | null;
          shared_with_mentee?: boolean;
          status?: string;
          updated_at?: string;
        };
        Update: {
          action?: string;
          attempt_id?: string;
          created_at?: string;
          created_by?: string;
          due_date?: string | null;
          enrollment_id?: string;
          id?: string;
          objective?: string;
          observations?: string | null;
          priority_focus?: string;
          progress_evidence?: string | null;
          responsible?: string | null;
          review_date?: string | null;
          shared_with_mentee?: boolean;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_development_plans_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "assessment_attempts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_development_plans_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_development_plans_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_development_private_notes: {
        Row: {
          author_id: string;
          content: string;
          created_at: string;
          id: string;
          plan_id: string;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          content: string;
          created_at?: string;
          id?: string;
          plan_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          content?: string;
          created_at?: string;
          id?: string;
          plan_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_development_private_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_development_private_notes_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "assessment_development_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_responses: {
        Row: {
          answered_at: string;
          attempt_id: string;
          id: string;
          item_id: string;
          perspective: string;
          value: number;
        };
        Insert: {
          answered_at?: string;
          attempt_id: string;
          id?: string;
          item_id: string;
          perspective: string;
          value: number;
        };
        Update: {
          answered_at?: string;
          attempt_id?: string;
          id?: string;
          item_id?: string;
          perspective?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_responses_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "assessment_attempts";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: string;
          payload: Json | null;
          target: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          payload?: Json | null;
          target?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          payload?: Json | null;
          target?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cohorts: {
        Row: {
          created_at: string;
          ends_on: string | null;
          id: string;
          name: string;
          starts_on: string | null;
        };
        Insert: {
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          name: string;
          starts_on?: string | null;
        };
        Update: {
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          name?: string;
          starts_on?: string | null;
        };
        Relationships: [];
      };
      consents: {
        Row: {
          granted: boolean;
          granted_at: string;
          id: string;
          kind: string;
          user_id: string;
        };
        Insert: {
          granted?: boolean;
          granted_at?: string;
          id?: string;
          kind: string;
          user_id: string;
        };
        Update: {
          granted?: boolean;
          granted_at?: string;
          id?: string;
          kind?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      deliverables: {
        Row: {
          description: string | null;
          id: string;
          phase_id: string;
          position: number;
          title: string;
        };
        Insert: {
          description?: string | null;
          id?: string;
          phase_id: string;
          position?: number;
          title: string;
        };
        Update: {
          description?: string | null;
          id?: string;
          phase_id?: string;
          position?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deliverables_phase_id_fkey";
            columns: ["phase_id"];
            isOneToOne: false;
            referencedRelation: "phases";
            referencedColumns: ["id"];
          },
        ];
      };
      enrollment_journey_versions: {
        Row: {
          assigned_at: string;
          enrollment_id: string;
          pillar_id: string;
          version_id: string;
        };
        Insert: {
          assigned_at?: string;
          enrollment_id: string;
          pillar_id: string;
          version_id: string;
        };
        Update: {
          assigned_at?: string;
          enrollment_id?: string;
          pillar_id?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrollment_journey_versions_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollment_journey_versions_pillar_id_fkey";
            columns: ["pillar_id"];
            isOneToOne: false;
            referencedRelation: "journey_pillars";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollment_journey_versions_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "journey_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      enrollments: {
        Row: {
          cohort_id: string | null;
          created_at: string;
          current_month: number;
          id: string;
          mentee_id: string;
          mentor_id: string | null;
          program_id: string;
          progress_pct: number;
          started_at: string;
          status: string;
        };
        Insert: {
          cohort_id?: string | null;
          created_at?: string;
          current_month?: number;
          id?: string;
          mentee_id: string;
          mentor_id?: string | null;
          program_id: string;
          progress_pct?: number;
          started_at?: string;
          status?: string;
        };
        Update: {
          cohort_id?: string | null;
          created_at?: string;
          current_month?: number;
          id?: string;
          mentee_id?: string;
          mentor_id?: string | null;
          program_id?: string;
          progress_pct?: number;
          started_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrollments_cohort_id_fkey";
            columns: ["cohort_id"];
            isOneToOne: false;
            referencedRelation: "cohorts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_mentee_id_fkey";
            columns: ["mentee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_mentor_id_fkey";
            columns: ["mentor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
        ];
      };
      journey_content_markers: {
        Row: {
          created_at: string;
          enrollment_id: string;
          id: string;
          reflection: string;
          step_key: string;
          timestamp_seconds: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          enrollment_id: string;
          id?: string;
          reflection: string;
          step_key: string;
          timestamp_seconds: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          enrollment_id?: string;
          id?: string;
          reflection?: string;
          step_key?: string;
          timestamp_seconds?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journey_content_markers_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_content_markers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      journey_content_notes: {
        Row: {
          content: string;
          created_at: string;
          enrollment_id: string;
          id: string;
          step_key: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content?: string;
          created_at?: string;
          enrollment_id: string;
          id?: string;
          step_key: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          enrollment_id?: string;
          id?: string;
          step_key?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journey_content_notes_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_content_notes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      journey_content_progress: {
        Row: {
          completed: boolean;
          completed_at: string | null;
          current_seconds: number;
          duration_seconds: number | null;
          enrollment_id: string;
          step_key: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed?: boolean;
          completed_at?: string | null;
          current_seconds?: number;
          duration_seconds?: number | null;
          enrollment_id: string;
          step_key: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed?: boolean;
          completed_at?: string | null;
          current_seconds?: number;
          duration_seconds?: number | null;
          enrollment_id?: string;
          step_key?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journey_content_progress_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_content_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      journey_pillars: {
        Row: {
          created_at: string;
          current_published_version_id: string | null;
          id: string;
          mentor_id: string | null;
          name: string;
          position: number;
          program_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_published_version_id?: string | null;
          id?: string;
          mentor_id?: string | null;
          name: string;
          position?: number;
          program_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_published_version_id?: string | null;
          id?: string;
          mentor_id?: string | null;
          name?: string;
          position?: number;
          program_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journey_pillars_current_published_version_id_fkey";
            columns: ["current_published_version_id"];
            isOneToOne: false;
            referencedRelation: "journey_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_pillars_mentor_id_fkey";
            columns: ["mentor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_pillars_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
        ];
      };
      journey_step_progress: {
        Row: {
          completed_at: string | null;
          confirmation_source: string | null;
          confirmed_by: string | null;
          created_at: string;
          enrollment_id: string;
          evidence: Json;
          id: string;
          status: string;
          step_key: string;
          updated_at: string;
        };
        Insert: {
          completed_at?: string | null;
          confirmation_source?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          enrollment_id: string;
          evidence?: Json;
          id?: string;
          status?: string;
          step_key: string;
          updated_at?: string;
        };
        Update: {
          completed_at?: string | null;
          confirmation_source?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          enrollment_id?: string;
          evidence?: Json;
          id?: string;
          status?: string;
          step_key?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journey_step_progress_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_step_progress_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
        ];
      };
      journey_steps: {
        Row: {
          access_scope: string;
          archived_at: string | null;
          cohort_id: string | null;
          completion_rule: string;
          cover_path: string | null;
          created_at: string;
          description: string;
          duration_minutes: number | null;
          format: string;
          id: string;
          impact_highlight: string;
          impact_lead: string;
          impact_tail: string;
          materials: Json;
          media_path: string | null;
          mentee_id: string | null;
          month_number: number;
          position: number;
          release_at: string | null;
          required: boolean;
          resource_id: string | null;
          resource_type: string | null;
          resource_url: string | null;
          responsible_name: string | null;
          scheduled_at: string | null;
          stable_key: string;
          summary: string;
          title: string;
          topics: string[];
          updated_at: string;
          version_id: string;
        };
        Insert: {
          access_scope?: string;
          archived_at?: string | null;
          cohort_id?: string | null;
          completion_rule?: string;
          cover_path?: string | null;
          created_at?: string;
          description?: string;
          duration_minutes?: number | null;
          format: string;
          id?: string;
          impact_highlight?: string;
          impact_lead?: string;
          impact_tail?: string;
          materials?: Json;
          media_path?: string | null;
          mentee_id?: string | null;
          month_number?: number;
          position?: number;
          release_at?: string | null;
          required?: boolean;
          resource_id?: string | null;
          resource_type?: string | null;
          resource_url?: string | null;
          responsible_name?: string | null;
          scheduled_at?: string | null;
          stable_key?: string;
          summary?: string;
          title: string;
          topics?: string[];
          updated_at?: string;
          version_id: string;
        };
        Update: {
          access_scope?: string;
          archived_at?: string | null;
          cohort_id?: string | null;
          completion_rule?: string;
          cover_path?: string | null;
          created_at?: string;
          description?: string;
          duration_minutes?: number | null;
          format?: string;
          id?: string;
          impact_highlight?: string;
          impact_lead?: string;
          impact_tail?: string;
          materials?: Json;
          media_path?: string | null;
          mentee_id?: string | null;
          month_number?: number;
          position?: number;
          release_at?: string | null;
          required?: boolean;
          resource_id?: string | null;
          resource_type?: string | null;
          resource_url?: string | null;
          responsible_name?: string | null;
          scheduled_at?: string | null;
          stable_key?: string;
          summary?: string;
          title?: string;
          topics?: string[];
          updated_at?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journey_steps_cohort_id_fkey";
            columns: ["cohort_id"];
            isOneToOne: false;
            referencedRelation: "cohorts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_steps_mentee_id_fkey";
            columns: ["mentee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_steps_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "journey_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      journey_versions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          pillar_id: string;
          published_at: string | null;
          revision: number;
          status: string;
          updated_at: string;
          version_number: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          pillar_id: string;
          published_at?: string | null;
          revision?: number;
          status?: string;
          updated_at?: string;
          version_number?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          pillar_id?: string;
          published_at?: string | null;
          revision?: number;
          status?: string;
          updated_at?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "journey_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_versions_pillar_id_fkey";
            columns: ["pillar_id"];
            isOneToOne: false;
            referencedRelation: "journey_pillars";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_markers: {
        Row: {
          created_at: string;
          enrollment_id: string;
          id: string;
          lesson_id: string;
          reflection: string;
          timestamp_seconds: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          enrollment_id: string;
          id?: string;
          lesson_id: string;
          reflection: string;
          timestamp_seconds: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          enrollment_id?: string;
          id?: string;
          lesson_id?: string;
          reflection?: string;
          timestamp_seconds?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_markers_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_markers_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_markers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_materials: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          file_path: string | null;
          id: string;
          kind: string;
          lesson_id: string | null;
          meeting_id: string | null;
          title: string;
          url: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          file_path?: string | null;
          id?: string;
          kind: string;
          lesson_id?: string | null;
          meeting_id?: string | null;
          title: string;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          file_path?: string | null;
          id?: string;
          kind?: string;
          lesson_id?: string | null;
          meeting_id?: string | null;
          title?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_materials_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_materials_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_progress: {
        Row: {
          completed: boolean;
          completed_at: string | null;
          enrollment_id: string;
          id: string;
          lesson_id: string;
        };
        Insert: {
          completed?: boolean;
          completed_at?: string | null;
          enrollment_id: string;
          id?: string;
          lesson_id: string;
        };
        Update: {
          completed?: boolean;
          completed_at?: string | null;
          enrollment_id?: string;
          id?: string;
          lesson_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lessons: {
        Row: {
          cover_url: string | null;
          created_at: string;
          description: string | null;
          duration_minutes: number | null;
          id: string;
          join_url: string | null;
          kind: Database["public"]["Enums"]["content_kind"];
          media_url: string | null;
          mentor_name: string | null;
          phase_id: string;
          position: number;
          scheduled_at: string | null;
          session_format: string | null;
          subtitle: string | null;
          title: string;
          topics: string[];
        };
        Insert: {
          cover_url?: string | null;
          created_at?: string;
          description?: string | null;
          duration_minutes?: number | null;
          id?: string;
          join_url?: string | null;
          kind?: Database["public"]["Enums"]["content_kind"];
          media_url?: string | null;
          mentor_name?: string | null;
          phase_id: string;
          position?: number;
          scheduled_at?: string | null;
          session_format?: string | null;
          subtitle?: string | null;
          title: string;
          topics?: string[];
        };
        Update: {
          cover_url?: string | null;
          created_at?: string;
          description?: string | null;
          duration_minutes?: number | null;
          id?: string;
          join_url?: string | null;
          kind?: Database["public"]["Enums"]["content_kind"];
          media_url?: string | null;
          mentor_name?: string | null;
          phase_id?: string;
          position?: number;
          scheduled_at?: string | null;
          session_format?: string | null;
          subtitle?: string | null;
          title?: string;
          topics?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "lessons_phase_id_fkey";
            columns: ["phase_id"];
            isOneToOne: false;
            referencedRelation: "phases";
            referencedColumns: ["id"];
          },
        ];
      };
      meeting_attendees: {
        Row: {
          enrollment_id: string;
          meeting_id: string;
        };
        Insert: {
          enrollment_id: string;
          meeting_id: string;
        };
        Update: {
          enrollment_id?: string;
          meeting_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      meetings: {
        Row: {
          audience: string;
          cohort_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          duration_minutes: number | null;
          ends_at: string | null;
          enrollment_id: string | null;
          google_event_id: string | null;
          id: string;
          join_url: string | null;
          kind: Database["public"]["Enums"]["meeting_kind"];
          lesson_id: string | null;
          mentor_id: string | null;
          mentor_name: string | null;
          phase_id: string | null;
          recording_url: string | null;
          scheduled_at: string;
          title: string;
        };
        Insert: {
          audience?: string;
          cohort_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          duration_minutes?: number | null;
          ends_at?: string | null;
          enrollment_id?: string | null;
          google_event_id?: string | null;
          id?: string;
          join_url?: string | null;
          kind?: Database["public"]["Enums"]["meeting_kind"];
          lesson_id?: string | null;
          mentor_id?: string | null;
          mentor_name?: string | null;
          phase_id?: string | null;
          recording_url?: string | null;
          scheduled_at: string;
          title: string;
        };
        Update: {
          audience?: string;
          cohort_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          duration_minutes?: number | null;
          ends_at?: string | null;
          enrollment_id?: string | null;
          google_event_id?: string | null;
          id?: string;
          join_url?: string | null;
          kind?: Database["public"]["Enums"]["meeting_kind"];
          lesson_id?: string | null;
          mentor_id?: string | null;
          mentor_name?: string | null;
          phase_id?: string | null;
          recording_url?: string | null;
          scheduled_at?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meetings_cohort_id_fkey";
            columns: ["cohort_id"];
            isOneToOne: false;
            referencedRelation: "cohorts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_mentor_id_fkey";
            columns: ["mentor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_phase_id_fkey";
            columns: ["phase_id"];
            isOneToOne: false;
            referencedRelation: "phases";
            referencedColumns: ["id"];
          },
        ];
      };
      mentor_specialties: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mentor_specialties_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          author_id: string;
          content: string;
          created_at: string;
          enrollment_id: string;
          id: string;
          lesson_id: string | null;
          visibility: Database["public"]["Enums"]["note_visibility"];
        };
        Insert: {
          author_id: string;
          content: string;
          created_at?: string;
          enrollment_id: string;
          id?: string;
          lesson_id?: string | null;
          visibility?: Database["public"]["Enums"]["note_visibility"];
        };
        Update: {
          author_id?: string;
          content?: string;
          created_at?: string;
          enrollment_id?: string;
          id?: string;
          lesson_id?: string | null;
          visibility?: Database["public"]["Enums"]["note_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      phases: {
        Row: {
          description: string | null;
          id: string;
          mentor_name: string | null;
          month_number: number;
          pillar: string;
          program_id: string;
          question: string | null;
          title: string;
        };
        Insert: {
          description?: string | null;
          id?: string;
          mentor_name?: string | null;
          month_number: number;
          pillar: string;
          program_id: string;
          question?: string | null;
          title: string;
        };
        Update: {
          description?: string | null;
          id?: string;
          mentor_name?: string | null;
          month_number?: number;
          pillar?: string;
          program_id?: string;
          question?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "phases_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          claimed: boolean;
          contact_email: string | null;
          created_at: string;
          display_name: string | null;
          email: string;
          full_name: string;
          id: string;
          mentor_summary: string | null;
          phone: string | null;
          pillar: string | null;
          primary_specialty_id: string | null;
          profession: string | null;
          profession_visible: boolean;
          staff_type: string | null;
          theme_preference: string;
          title: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          claimed?: boolean;
          contact_email?: string | null;
          created_at?: string;
          display_name?: string | null;
          email: string;
          full_name: string;
          id?: string;
          mentor_summary?: string | null;
          phone?: string | null;
          pillar?: string | null;
          primary_specialty_id?: string | null;
          profession?: string | null;
          profession_visible?: boolean;
          staff_type?: string | null;
          theme_preference?: string;
          title?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          claimed?: boolean;
          contact_email?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          mentor_summary?: string | null;
          phone?: string | null;
          pillar?: string | null;
          primary_specialty_id?: string | null;
          profession?: string | null;
          profession_visible?: boolean;
          staff_type?: string | null;
          theme_preference?: string;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_primary_specialty_id_fkey";
            columns: ["primary_specialty_id"];
            isOneToOne: false;
            referencedRelation: "mentor_specialties";
            referencedColumns: ["id"];
          },
        ];
      };
      programs: {
        Row: {
          created_at: string;
          description: string | null;
          duration_months: number;
          id: string;
          name: string;
          tagline: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          duration_months?: number;
          id?: string;
          name: string;
          tagline?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          duration_months?: number;
          id?: string;
          name?: string;
          tagline?: string | null;
        };
        Relationships: [];
      };
      rise90_goals: {
        Row: {
          created_at: string;
          current_value: number;
          deadline: string | null;
          description: string | null;
          enrollment_id: string;
          horizon: string | null;
          id: string;
          metric: string | null;
          position: number;
          progress_pct: number;
          target_value: number | null;
          title: string;
        };
        Insert: {
          created_at?: string;
          current_value?: number;
          deadline?: string | null;
          description?: string | null;
          enrollment_id: string;
          horizon?: string | null;
          id?: string;
          metric?: string | null;
          position?: number;
          progress_pct?: number;
          target_value?: number | null;
          title: string;
        };
        Update: {
          created_at?: string;
          current_value?: number;
          deadline?: string | null;
          description?: string | null;
          enrollment_id?: string;
          horizon?: string | null;
          id?: string;
          metric?: string | null;
          position?: number;
          progress_pct?: number;
          target_value?: number | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rise90_goals_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
        ];
      };
      rise90_milestones: {
        Row: {
          created_at: string;
          done: boolean;
          goal_id: string;
          id: string;
          position: number;
          title: string;
        };
        Insert: {
          created_at?: string;
          done?: boolean;
          goal_id: string;
          id?: string;
          position?: number;
          title: string;
        };
        Update: {
          created_at?: string;
          done?: boolean;
          goal_id?: string;
          id?: string;
          position?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rise90_milestones_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "rise90_goals";
            referencedColumns: ["id"];
          },
        ];
      };
      submissions: {
        Row: {
          content: string | null;
          deliverable_id: string;
          enrollment_id: string;
          feedback: string | null;
          file_path: string | null;
          id: string;
          link_url: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["submission_status"];
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: {
          content?: string | null;
          deliverable_id: string;
          enrollment_id: string;
          feedback?: string | null;
          file_path?: string | null;
          id?: string;
          link_url?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["submission_status"];
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          content?: string | null;
          deliverable_id?: string;
          enrollment_id?: string;
          feedback?: string | null;
          file_path?: string | null;
          id?: string;
          link_url?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["submission_status"];
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "submissions_deliverable_id_fkey";
            columns: ["deliverable_id"];
            isOneToOne: false;
            referencedRelation: "deliverables";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submissions_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submissions_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_notifications: {
        Row: {
          created_at: string;
          error_message: string | null;
          event_type: string;
          id: string;
          idempotency_key: string;
          message: string;
          phone: string | null;
          provider_message_id: string | null;
          recipient_role: string;
          recipient_user_id: string | null;
          reference_id: string | null;
          reference_type: string | null;
          sent_at: string | null;
          status: string;
          target_url: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          event_type: string;
          id?: string;
          idempotency_key: string;
          message: string;
          phone?: string | null;
          provider_message_id?: string | null;
          recipient_role: string;
          recipient_user_id?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          sent_at?: string | null;
          status?: string;
          target_url: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          event_type?: string;
          id?: string;
          idempotency_key?: string;
          message?: string;
          phone?: string | null;
          provider_message_id?: string | null;
          recipient_role?: string;
          recipient_user_id?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          sent_at?: string | null;
          status?: string;
          target_url?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_notifications_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_settings: {
        Row: {
          created_at: string;
          enabled_account_created: boolean;
          enabled_meeting_reminder: boolean;
          enabled_stage_completed_mentee: boolean;
          enabled_stage_completed_mentor: boolean;
          enabled_stage_released: boolean;
          engine: string;
          id: string;
          meeting_reminder_hours: number;
          session_name: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          enabled_account_created?: boolean;
          enabled_meeting_reminder?: boolean;
          enabled_stage_completed_mentee?: boolean;
          enabled_stage_completed_mentor?: boolean;
          enabled_stage_released?: boolean;
          engine?: string;
          id?: string;
          meeting_reminder_hours?: number;
          session_name?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          enabled_account_created?: boolean;
          enabled_meeting_reminder?: boolean;
          enabled_stage_completed_mentee?: boolean;
          enabled_stage_completed_mentor?: boolean;
          enabled_stage_released?: boolean;
          engine?: string;
          id?: string;
          meeting_reminder_hours?: number;
          session_name?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_access_enrollment: {
        Args: { _enrollment_id: string };
        Returns: boolean;
      };
      can_access_journey_step: { Args: { _step_key: string }; Returns: boolean };
      can_manage_journey_pillar: {
        Args: { _pillar_id: string };
        Returns: boolean;
      };
      can_see_meeting: { Args: { _meeting_id: string }; Returns: boolean };
      get_next_journey_step: { Args: never; Returns: Json };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      is_enrollment_mentee: {
        Args: { _enrollment_id: string };
        Returns: boolean;
      };
      is_staff: { Args: never; Returns: boolean };
      mentee_public_profile: {
        Args: { _enrollment_id: string };
        Returns: {
          avatar_url: string;
          display_name: string;
          id: string;
          profession: string;
          profession_visible: boolean;
        }[];
      };
      notify_meeting_audience: {
        Args: {
          _body: string;
          _meeting_id: string;
          _title: string;
          _type: string;
        };
        Returns: undefined;
      };
      publish_journey_draft: {
        Args: {
          p_apply_active?: boolean;
          p_expected_revision: number;
          p_pillar_id: string;
        };
        Returns: string;
      };
      save_journey_draft: {
        Args: {
          p_expected_revision: number;
          p_pillar_id: string;
          p_steps: Json;
        };
        Returns: number;
      };
      staff_directory: {
        Args: never;
        Returns: {
          avatar_url: string;
          contact_email: string;
          full_name: string;
          id: string;
          is_admin: boolean;
          phone: string;
          specialty: string;
          staff_type: string;
          title: string;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "mentor" | "mentee";
      content_kind: "aula" | "atividade" | "encontro" | "material";
      invite_status: "approved" | "revoked";
      meeting_kind: "grupo" | "individual";
      note_visibility: "mentee_private" | "mentor_private" | "shared";
      submission_status: "nao_iniciada" | "em_andamento" | "enviada" | "em_revisao" | "concluida";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "mentor", "mentee"],
      content_kind: ["aula", "atividade", "encontro", "material"],
      invite_status: ["approved", "revoked"],
      meeting_kind: ["grupo", "individual"],
      note_visibility: ["mentee_private", "mentor_private", "shared"],
      submission_status: ["nao_iniciada", "em_andamento", "enviada", "em_revisao", "concluida"],
    },
  },
} as const;
