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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      areas: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "areas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          cnpj: string | null
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      meeting_atas: {
        Row: {
          action_items: Json | null
          approved_at: string | null
          approved_by: string | null
          content: string | null
          created_at: string
          decisions: Json | null
          id: string
          meeting_id: string
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          action_items?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          content?: string | null
          created_at?: string
          decisions?: Json | null
          id?: string
          meeting_id: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          action_items?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          content?: string | null
          created_at?: string
          decisions?: Json | null
          id?: string
          meeting_id?: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_atas_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          attended: boolean
          confirmation_reminder_sent_at: string | null
          confirmation_status: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string
          id: string
          meeting_id: string
          user_id: string
        }
        Insert: {
          attended?: boolean
          confirmation_reminder_sent_at?: string | null
          confirmation_status?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          meeting_id: string
          user_id: string
        }
        Update: {
          attended?: boolean
          confirmation_reminder_sent_at?: string | null
          confirmation_status?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          meeting_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_reminders: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          reminder_type: string
          sent_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          reminder_type: string
          sent_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_reminders_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_rooms: {
        Row: {
          area_id: string | null
          company: string
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          team: string
          teams_link: string
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          company: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          team: string
          teams_link: string
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          company?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          team?: string
          teams_link?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_rooms_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_rooms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_tasks: {
        Row: {
          assignee_id: string | null
          ata_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          meeting_id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          ata_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          ata_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_tasks_ata_id_fkey"
            columns: ["ata_id"]
            isOneToOne: false
            referencedRelation: "meeting_atas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_transcriptions: {
        Row: {
          content: string | null
          created_at: string
          id: string
          meeting_id: string
          processed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          meeting_id: string
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          meeting_id?: string
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_transcriptions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          ai_mode: string
          area_id: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number
          id: string
          meeting_room_id: string | null
          parent_meeting_id: string | null
          recurrence_end_date: string | null
          recurrence_index: number | null
          recurrence_type: string | null
          scheduled_at: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          ai_mode?: string
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          meeting_room_id?: string | null
          parent_meeting_id?: string | null
          recurrence_end_date?: string | null
          recurrence_index?: number | null
          recurrence_type?: string | null
          scheduled_at: string
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          ai_mode?: string
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          meeting_room_id?: string | null
          parent_meeting_id?: string | null
          recurrence_end_date?: string | null
          recurrence_index?: number | null
          recurrence_type?: string | null
          scheduled_at?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_meeting_room_id_fkey"
            columns: ["meeting_room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_parent_meeting_id_fkey"
            columns: ["parent_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          area_id: string | null
          avatar_url: string | null
          company_id: string | null
          created_at: string | null
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          area_id?: string | null
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          first_name?: string | null
          id: string
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          area_id?: string | null
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      trade_industries: {
        Row: {
          cnpj: string | null
          company_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          cnpj?: string | null
          company_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          cnpj?: string | null
          company_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_industries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_inventory_movements: {
        Row: {
          client_name: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          material_id: string
          movement_date: string
          movement_type: string
          notes: string | null
          quantity: number
          received_by: string | null
          reference_number: string | null
          unit_cost: number | null
        }
        Insert: {
          client_name?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          material_id: string
          movement_date?: string
          movement_type: string
          notes?: string | null
          quantity: number
          received_by?: string | null
          reference_number?: string | null
          unit_cost?: number | null
        }
        Update: {
          client_name?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          material_id?: string
          movement_date?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          received_by?: string | null
          reference_number?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_inventory_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "trade_inventory_balance"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "trade_inventory_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "trade_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_materials: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          industry_id: string | null
          is_active: boolean | null
          name: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          industry_id?: string | null
          is_active?: boolean | null
          name: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          industry_id?: string | null
          is_active?: boolean | null
          name?: string
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_materials_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "trade_industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_materials_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "trade_inventory_balance"
            referencedColumns: ["industry_id"]
          },
        ]
      }
      user_invites: {
        Row: {
          area_id: string | null
          company_id: string | null
          created_at: string | null
          email: string
          expires_at: string
          first_name: string | null
          id: string
          invited_by: string | null
          last_name: string | null
          roles: string[]
          status: string
          token: string | null
          updated_at: string | null
        }
        Insert: {
          area_id?: string | null
          company_id?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by?: string | null
          last_name?: string | null
          roles?: string[]
          status?: string
          token?: string | null
          updated_at?: string | null
        }
        Update: {
          area_id?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by?: string | null
          last_name?: string | null
          roles?: string[]
          status?: string
          token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invites_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string | null
          id: string
          module: Database["public"]["Enums"]["system_module"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string | null
          id?: string
          module: Database["public"]["Enums"]["system_module"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string | null
          id?: string
          module?: Database["public"]["Enums"]["system_module"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      trade_inventory_balance: {
        Row: {
          category: string | null
          company_id: string | null
          current_stock: number | null
          industry_id: string | null
          industry_logo: string | null
          industry_name: string | null
          last_movement: string | null
          material_id: string | null
          material_image: string | null
          material_name: string | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_permission: {
        Args: {
          _action: string
          _module: Database["public"]["Enums"]["system_module"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "ceo" | "diretor" | "gerente" | "colaborador" | "super_admin"
      system_module:
        | "dashboard_executivo"
        | "dashboard_pessoal"
        | "meetings"
        | "calendar"
        | "tasks"
        | "processes"
        | "trade"
        | "reports"
        | "admin"
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
      app_role: ["ceo", "diretor", "gerente", "colaborador", "super_admin"],
      system_module: [
        "dashboard_executivo",
        "dashboard_pessoal",
        "meetings",
        "calendar",
        "tasks",
        "processes",
        "trade",
        "reports",
        "admin",
      ],
    },
  },
} as const
