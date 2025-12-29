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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      calendar_connections: {
        Row: {
          auth_error_message: string | null
          connection_name: string
          connection_status: string | null
          connection_type: string
          created_at: string
          external_calendar_id: string
          id: string
          is_active: boolean | null
          last_auth_at: string | null
          last_sync_at: string | null
          sync_frequency: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_error_message?: string | null
          connection_name: string
          connection_status?: string | null
          connection_type: string
          created_at?: string
          external_calendar_id: string
          id?: string
          is_active?: boolean | null
          last_auth_at?: string | null
          last_sync_at?: string | null
          sync_frequency?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_error_message?: string | null
          connection_name?: string
          connection_status?: string | null
          connection_type?: string
          created_at?: string
          external_calendar_id?: string
          id?: string
          is_active?: boolean | null
          last_auth_at?: string | null
          last_sync_at?: string | null
          sync_frequency?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_event_exceptions: {
        Row: {
          created_at: string
          exception_date: string
          exception_type: string
          id: string
          master_event_id: string
          modified_data: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exception_date: string
          exception_type: string
          id?: string
          master_event_id: string
          modified_data?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exception_date?: string
          exception_type?: string
          id?: string
          master_event_id?: string
          modified_data?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_exceptions_master_event_id_fkey"
            columns: ["master_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          category: string | null
          color: string
          completed: boolean | null
          created_at: string
          description: string | null
          duration: number | null
          end_time: string
          event_type: string | null
          external_calendar_id: string | null
          external_last_modified: string | null
          external_source: string | null
          external_url: string | null
          id: string
          is_external_event: boolean | null
          project_id: string | null
          recurring_count: number | null
          recurring_end_date: string | null
          recurring_group_id: string | null
          recurring_interval: number | null
          recurring_type: string | null
          rrule: string | null
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          color: string
          completed?: boolean | null
          created_at?: string
          description?: string | null
          duration?: number | null
          end_time: string
          event_type?: string | null
          external_calendar_id?: string | null
          external_last_modified?: string | null
          external_source?: string | null
          external_url?: string | null
          id?: string
          is_external_event?: boolean | null
          project_id?: string | null
          recurring_count?: number | null
          recurring_end_date?: string | null
          recurring_group_id?: string | null
          recurring_interval?: number | null
          recurring_type?: string | null
          rrule?: string | null
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          color?: string
          completed?: boolean | null
          created_at?: string
          description?: string | null
          duration?: number | null
          end_time?: string
          event_type?: string | null
          external_calendar_id?: string | null
          external_last_modified?: string | null
          external_source?: string | null
          external_url?: string | null
          id?: string
          is_external_event?: boolean | null
          project_id?: string | null
          recurring_count?: number | null
          recurring_end_date?: string | null
          recurring_group_id?: string | null
          recurring_interval?: number | null
          recurring_type?: string | null
          rrule?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_import_history: {
        Row: {
          connection_id: string | null
          created_at: string
          error_message: string | null
          events_failed: number | null
          events_imported: number | null
          events_updated: number | null
          file_name: string | null
          id: string
          import_date_range_end: string | null
          import_date_range_start: string | null
          import_source: string
          import_status: string | null
          import_type: string
          user_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          events_failed?: number | null
          events_imported?: number | null
          events_updated?: number | null
          file_name?: string | null
          id?: string
          import_date_range_end?: string | null
          import_date_range_start?: string | null
          import_source: string
          import_status?: string | null
          import_type: string
          user_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          events_failed?: number | null
          events_imported?: number | null
          events_updated?: number | null
          file_name?: string | null
          id?: string
          import_date_range_end?: string | null
          import_date_range_start?: string | null
          import_source?: string
          import_status?: string | null
          import_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_import_history_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string | null
          feedback_text: string
          feedback_type: string
          id: string
          status: string | null
          url: string | null
          usage_context: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          feedback_text: string
          feedback_type: string
          id?: string
          status?: string | null
          url?: string | null
          usage_context: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          feedback_text?: string
          feedback_type?: string
          id?: string
          status?: string | null
          url?: string | null
          usage_context?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      feedback_attachments: {
        Row: {
          created_at: string | null
          feedback_id: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
        }
        Insert: {
          created_at?: string | null
          feedback_id?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
        }
        Update: {
          created_at?: string | null
          feedback_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_attachments_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          end_date: string
          id: string
          notes: string | null
          start_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          created_at: string
          due_date: string
          id: string
          is_recurring: boolean | null
          name: string
          project_id: string
          recurring_config: Json | null
          start_date: string | null
          time_allocation: number
          time_allocation_hours: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          is_recurring?: boolean | null
          name: string
          project_id: string
          recurring_config?: Json | null
          start_date?: string | null
          time_allocation: number
          time_allocation_hours?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          is_recurring?: boolean | null
          name?: string
          project_id?: string
          recurring_config?: Json | null
          start_date?: string | null
          time_allocation?: number
          time_allocation_hours?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones_backup_20251018: {
        Row: {
          created_at: string | null
          due_date: string | null
          id: string | null
          name: string | null
          order_index: number | null
          project_id: string | null
          time_allocation: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          due_date?: string | null
          id?: string | null
          name?: string | null
          order_index?: number | null
          project_id?: string | null
          time_allocation?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          due_date?: string | null
          id?: string | null
          name?: string | null
          order_index?: number | null
          project_id?: string | null
          time_allocation?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_labels: {
        Row: {
          created_at: string
          label_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          label_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          label_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_labels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client: string
          client_id: string
          color: string
          continuous: boolean | null
          created_at: string
          end_date: string
          estimated_hours: number
          group_id: string
          icon: string | null
          id: string
          name: string
          notes: string | null
          row_id: string | null
          start_date: string
          updated_at: string
          user_id: string
          working_day_overrides: Json | null
        }
        Insert: {
          client: string
          client_id: string
          color: string
          continuous?: boolean | null
          created_at?: string
          end_date: string
          estimated_hours: number
          group_id: string
          icon?: string | null
          id?: string
          name: string
          notes?: string | null
          row_id?: string | null
          start_date: string
          updated_at?: string
          user_id: string
          working_day_overrides?: Json | null
        }
        Update: {
          client?: string
          client_id?: string
          color?: string
          continuous?: boolean | null
          created_at?: string
          end_date?: string
          estimated_hours?: number
          group_id?: string
          icon?: string | null
          id?: string
          name?: string
          notes?: string | null
          row_id?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
          working_day_overrides?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "rows"
            referencedColumns: ["id"]
          },
        ]
      }
      rows: {
        Row: {
          created_at: string
          group_id: string
          id: string
          name: string
          order_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          name: string
          order_index: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          order_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rows_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          id: string
          time_tracking_state: Json | null
          updated_at: string
          user_id: string
          weekly_work_hours: Json
        }
        Insert: {
          created_at?: string
          id?: string
          time_tracking_state?: Json | null
          updated_at?: string
          user_id: string
          weekly_work_hours?: Json
        }
        Update: {
          created_at?: string
          id?: string
          time_tracking_state?: Json | null
          updated_at?: string
          user_id?: string
          weekly_work_hours?: Json
        }
        Relationships: []
      }
      usage_analytics: {
        Row: {
          event_category: string
          event_type: string
          id: string
          metadata: Json | null
          timestamp: string | null
          user_id_hash: string
        }
        Insert: {
          event_category: string
          event_type: string
          id?: string
          metadata?: Json | null
          timestamp?: string | null
          user_id_hash: string
        }
        Update: {
          event_category?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          timestamp?: string | null
          user_id_hash?: string
        }
        Relationships: []
      }
      work_slot_exceptions: {
        Row: {
          created_at: string
          day_of_week: string
          exception_date: string
          exception_type: string
          id: string
          modified_end_time: string | null
          modified_start_time: string | null
          slot_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: string
          exception_date: string
          exception_type: string
          id?: string
          modified_end_time?: string | null
          modified_start_time?: string | null
          slot_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: string
          exception_date?: string
          exception_type?: string
          id?: string
          modified_end_time?: string | null
          modified_start_time?: string | null
          slot_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hash_user_id: { Args: { user_uuid: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
