// Genererad från live-schemat. Regenerera efter varje migration
// (Supabase MCP: generate_typescript_types).
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          digest_enabled: boolean
          digest_hour: number
          digest_weekday: number
          edit_window_hours: number
          id: number
          materialize_horizon_months: number
          reminder_lookback_minutes: number
          retention_months: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          digest_enabled?: boolean
          digest_hour?: number
          digest_weekday?: number
          edit_window_hours?: number
          id?: number
          materialize_horizon_months?: number
          reminder_lookback_minutes?: number
          retention_months?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          digest_enabled?: boolean
          digest_hour?: number
          digest_weekday?: number
          edit_window_hours?: number
          id?: number
          materialize_horizon_months?: number
          reminder_lookback_minutes?: number
          retention_months?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          group_id: string | null
          id: number
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          group_id?: string | null
          id?: never
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          group_id?: string | null
          id?: never
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      digest_log: {
        Row: {
          error: string | null
          group_id: string
          id: string
          period_start: string
          sent_at: string | null
          status: string
        }
        Insert: {
          error?: string | null
          group_id: string
          id?: string
          period_start: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          error?: string | null
          group_id?: string
          id?: string
          period_start?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      event_assignees: {
        Row: { event_id: string; group_id: string; person_id: string }
        Insert: { event_id: string; group_id: string; person_id: string }
        Update: { event_id?: string; group_id?: string; person_id?: string }
        Relationships: [
          {
            foreignKeyName: "event_assignees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders: {
        Row: {
          at_time: string | null
          bring_list: string[]
          created_at: string
          created_by: string | null
          custom_emails: string[]
          event_id: string
          fire_at: string | null
          group_id: string
          id: string
          message: string | null
          offset_kind: string
          offset_minutes: number | null
          recipient_mode: string
          updated_at: string
        }
        Insert: {
          at_time?: string | null
          bring_list?: string[]
          created_at?: string
          created_by?: string | null
          custom_emails?: string[]
          event_id: string
          fire_at?: string | null
          group_id: string
          id?: string
          message?: string | null
          offset_kind: string
          offset_minutes?: number | null
          recipient_mode?: string
          updated_at?: string
        }
        Update: {
          at_time?: string | null
          bring_list?: string[]
          created_at?: string
          created_by?: string | null
          custom_emails?: string[]
          event_id?: string
          fire_at?: string | null
          group_id?: string
          id?: string
          message?: string | null
          offset_kind?: string
          offset_minutes?: number | null
          recipient_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series: {
        Row: {
          all_day: boolean
          bymonthday: number | null
          byweekday: number[] | null
          count: number | null
          created_at: string
          created_by: string | null
          dropoff_person_id: string | null
          dtstart: string
          duration_minutes: number
          freq: string
          group_id: string
          icon_key: string | null
          id: string
          interval: number
          is_private: boolean
          location: string | null
          notes: string | null
          pickup_person_id: string | null
          start_time: string | null
          title: string
          until: string | null
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          bymonthday?: number | null
          byweekday?: number[] | null
          count?: number | null
          created_at?: string
          created_by?: string | null
          dropoff_person_id?: string | null
          dtstart: string
          duration_minutes?: number
          freq: string
          group_id: string
          icon_key?: string | null
          id?: string
          interval?: number
          is_private?: boolean
          location?: string | null
          notes?: string | null
          pickup_person_id?: string | null
          start_time?: string | null
          title: string
          until?: string | null
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          bymonthday?: number | null
          byweekday?: number[] | null
          count?: number | null
          created_at?: string
          created_by?: string | null
          dropoff_person_id?: string | null
          dtstart?: string
          duration_minutes?: number
          freq?: string
          group_id?: string
          icon_key?: string | null
          id?: string
          interval?: number
          is_private?: boolean
          location?: string | null
          notes?: string | null
          pickup_person_id?: string | null
          start_time?: string | null
          title?: string
          until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      event_series_assignees: {
        Row: { group_id: string; person_id: string; series_id: string }
        Insert: { group_id: string; person_id: string; series_id: string }
        Update: { group_id?: string; person_id?: string; series_id?: string }
        Relationships: [
          {
            foreignKeyName: "event_series_assignees_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series_reminders: {
        Row: {
          at_time: string | null
          bring_list: string[]
          created_at: string
          created_by: string | null
          custom_emails: string[]
          group_id: string
          id: string
          message: string | null
          offset_kind: string
          offset_minutes: number | null
          recipient_mode: string
          series_id: string
        }
        Insert: {
          at_time?: string | null
          bring_list?: string[]
          created_at?: string
          created_by?: string | null
          custom_emails?: string[]
          group_id: string
          id?: string
          message?: string | null
          offset_kind: string
          offset_minutes?: number | null
          recipient_mode?: string
          series_id: string
        }
        Update: {
          at_time?: string | null
          bring_list?: string[]
          created_at?: string
          created_by?: string | null
          custom_emails?: string[]
          group_id?: string
          id?: string
          message?: string | null
          offset_kind?: string
          offset_minutes?: number | null
          recipient_mode?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_series_reminders_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          created_at: string
          created_by: string | null
          dropoff_person_id: string | null
          ends_at: string
          group_id: string
          icon_key: string | null
          id: string
          is_private: boolean
          location: string | null
          notes: string | null
          occurrence_date: string | null
          overridden: boolean
          pickup_person_id: string | null
          series_id: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          dropoff_person_id?: string | null
          ends_at: string
          group_id: string
          icon_key?: string | null
          id?: string
          is_private?: boolean
          location?: string | null
          notes?: string | null
          occurrence_date?: string | null
          overridden?: boolean
          pickup_person_id?: string | null
          series_id?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          dropoff_person_id?: string | null
          ends_at?: string
          group_id?: string
          icon_key?: string | null
          id?: string
          is_private?: boolean
          location?: string | null
          notes?: string | null
          occurrence_date?: string | null
          overridden?: boolean
          pickup_person_id?: string | null
          series_id?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meal_ingredients: {
        Row: {
          created_at: string
          group_id: string
          id: string
          meal_id: string
          position: number
          quantity: string | null
          text: string
        }
        Insert: {
          created_at?: string
          group_id?: string
          id?: string
          meal_id: string
          position?: number
          quantity?: string | null
          text: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          meal_id?: string
          position?: number
          quantity?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_ingredients_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          freetext: string | null
          group_id: string
          id: string
          meal_id: string | null
          slot: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          freetext?: string | null
          group_id: string
          id?: string
          meal_id?: string | null
          slot?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          freetext?: string | null
          group_id?: string
          id?: string
          meal_id?: string | null
          slot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          kind: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          kind?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          kind?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lists_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          list_id: string
          note: string | null
          position: number
          text: string
          updated_at: string
        }
        Insert: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          list_id: string
          note?: string | null
          position?: number
          text: string
          updated_at?: string
        }
        Update: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          list_id?: string
          note?: string | null
          position?: number
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          birthdate: string | null
          color: string | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          group_id: string
          icon_key: string | null
          id: string
          kind: string
          linked_user_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          birthdate?: string | null
          color?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          group_id: string
          icon_key?: string | null
          id?: string
          kind?: string
          linked_user_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          birthdate?: string | null
          color?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          group_id?: string
          icon_key?: string | null
          id?: string
          kind?: string
          linked_user_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      people_parents: {
        Row: { group_id: string; parent_person_id: string; person_id: string }
        Insert: { group_id: string; parent_person_id: string; person_id: string }
        Update: { group_id?: string; parent_person_id?: string; person_id?: string }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          email: string | null
          id: string
          is_super_admin: boolean
          name: string | null
          notify_email: boolean
          updated_at: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          email?: string | null
          id: string
          is_super_admin?: boolean
          name?: string | null
          notify_email?: boolean
          updated_at?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          email?: string | null
          id?: string
          is_super_admin?: boolean
          name?: string | null
          notify_email?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      reminder_log: {
        Row: {
          attempts: number
          claimed_at: string | null
          error: string | null
          fire_at: string
          id: string
          reminder_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          error?: string | null
          fire_at: string
          id?: string
          reminder_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          error?: string | null
          fire_at?: string
          id?: string
          reminder_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      series_split: {
        Args: { p_from_event: string; patch: Json }
        Returns: string
      }
      add_meal_to_list: {
        Args: { p_meal: string; p_list: string }
        Returns: number
      }
      purge_audit_logs: {
        Args: { older_than_days?: number }
        Returns: number
      }
      gdpr_purge: {
        Args: { dry_run?: boolean }
        Returns: Json
      }
    }
    Enums: {
      group_role: "admin" | "medlem" | "begransad"
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
      group_role: ["admin", "medlem", "begransad"],
    },
  },
} as const

// --- Bekvämlighetsalias (används i app-koden) ---
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type AppSettings = Database["public"]["Tables"]["app_settings"]["Row"]
export type GroupRole = Database["public"]["Enums"]["group_role"]
export type Group = Database["public"]["Tables"]["groups"]["Row"]
export type GroupMember = Database["public"]["Tables"]["group_members"]["Row"]
export type Person = Database["public"]["Tables"]["people"]["Row"]
export type EventRow = Database["public"]["Tables"]["events"]["Row"]
export type EventInsert = Database["public"]["Tables"]["events"]["Insert"]
export type EventSeries = Database["public"]["Tables"]["event_series"]["Row"]
export type EventReminder = Database["public"]["Tables"]["event_reminders"]["Row"]
export type EventSeriesReminder = Database["public"]["Tables"]["event_series_reminders"]["Row"]
export type ListRow = Database["public"]["Tables"]["lists"]["Row"]
export type ListItem = Database["public"]["Tables"]["list_items"]["Row"]
export type Meal = Database["public"]["Tables"]["meals"]["Row"]
export type MealIngredient = Database["public"]["Tables"]["meal_ingredients"]["Row"]
export type MealPlanRow = Database["public"]["Tables"]["meal_plan"]["Row"]
