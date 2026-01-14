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
      audit_logs: {
        Row: {
          action_type: string
          actor_id: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          actor_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          actor_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string
          color: string
          condition_type: string
          condition_value: number
          created_at: string | null
          description: string | null
          icon: string
          id: string
          is_active: boolean | null
          name: string
          points_required: number | null
        }
        Insert: {
          category?: string
          color?: string
          condition_type: string
          condition_value?: number
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          name: string
          points_required?: number | null
        }
        Update: {
          category?: string
          color?: string
          condition_type?: string
          condition_value?: number
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          name?: string
          points_required?: number | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          cnpj: string | null
          color: string | null
          created_at: string
          external_id: string | null
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
          external_id?: string | null
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
          external_id?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      csv_import_templates: {
        Row: {
          column_mapping: Json
          company_id: string | null
          created_at: string | null
          created_by: string | null
          date_format: string | null
          delimiter: string | null
          has_header: boolean | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          column_mapping: Json
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_format?: string | null
          delimiter?: string | null
          has_header?: boolean | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          column_mapping?: Json
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_format?: string | null
          delimiter?: string | null
          has_header?: boolean | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "csv_import_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      distributors: {
        Row: {
          code: string | null
          company_id: string | null
          created_at: string | null
          external_id: string
          id: string
          is_active: boolean | null
          name: string
          region: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          created_at?: string | null
          external_id: string
          id?: string
          is_active?: boolean | null
          name: string
          region?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string | null
          created_at?: string | null
          external_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          region?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distributors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      external_employees: {
        Row: {
          cod_vendedor: string | null
          company_id: string | null
          cpf: string | null
          created_at: string | null
          department: string | null
          email: string | null
          external_id: string
          full_name: string
          hire_date: string | null
          id: string
          is_active: boolean | null
          is_condutor: boolean | null
          lider_direto_id: string | null
          linked_profile_id: string | null
          metadata: Json | null
          phone: string | null
          position: string | null
          registration_number: string | null
          source_system: string | null
          synced_at: string | null
          unidade: string | null
          updated_at: string | null
        }
        Insert: {
          cod_vendedor?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          external_id: string
          full_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          is_condutor?: boolean | null
          lider_direto_id?: string | null
          linked_profile_id?: string | null
          metadata?: Json | null
          phone?: string | null
          position?: string | null
          registration_number?: string | null
          source_system?: string | null
          synced_at?: string | null
          unidade?: string | null
          updated_at?: string | null
        }
        Update: {
          cod_vendedor?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          external_id?: string
          full_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          is_condutor?: boolean | null
          lider_direto_id?: string | null
          linked_profile_id?: string | null
          metadata?: Json | null
          phone?: string | null
          position?: string | null
          registration_number?: string | null
          source_system?: string | null
          synced_at?: string | null
          unidade?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_employees_lider_direto_id_fkey"
            columns: ["lider_direto_id"]
            isOneToOne: false
            referencedRelation: "external_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_employees_linked_profile_id_fkey"
            columns: ["linked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_entries: {
        Row: {
          created_at: string | null
          created_by: string | null
          entry_date: string
          goal_id: string
          id: string
          notes: string | null
          value: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          entry_date: string
          goal_id: string
          id?: string
          notes?: string | null
          value: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          entry_date?: string
          goal_id?: string
          id?: string
          notes?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_entries_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_types: {
        Row: {
          calculation_type: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          calculation_type?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          calculation_type?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          area_id: string | null
          auto_calculate: boolean | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          current_value: number | null
          distributor_id: string | null
          end_date: string
          goal_type_id: string | null
          id: string
          last_calculated_at: string | null
          metric_type: string | null
          name: string
          notes: string | null
          period_type: string | null
          product_filter: string | null
          responsible_id: string | null
          start_date: string
          status: string | null
          target_value: number
          updated_at: string | null
        }
        Insert: {
          area_id?: string | null
          auto_calculate?: boolean | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_value?: number | null
          distributor_id?: string | null
          end_date: string
          goal_type_id?: string | null
          id?: string
          last_calculated_at?: string | null
          metric_type?: string | null
          name: string
          notes?: string | null
          period_type?: string | null
          product_filter?: string | null
          responsible_id?: string | null
          start_date: string
          status?: string | null
          target_value: number
          updated_at?: string | null
        }
        Update: {
          area_id?: string | null
          auto_calculate?: boolean | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_value?: number | null
          distributor_id?: string | null
          end_date?: string
          goal_type_id?: string | null
          id?: string
          last_calculated_at?: string | null
          metric_type?: string | null
          name?: string
          notes?: string | null
          period_type?: string | null
          product_filter?: string | null
          responsible_id?: string | null
          start_date?: string
          status?: string | null
          target_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_goal_type_id_fkey"
            columns: ["goal_type_id"]
            isOneToOne: false
            referencedRelation: "goal_types"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agendas: {
        Row: {
          content: string
          created_at: string
          id: string
          is_completed: boolean
          meeting_id: string
          order_index: number
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_completed?: boolean
          meeting_id: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          meeting_id?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agendas_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
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
          platform: string | null
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
          platform?: string | null
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
          platform?: string | null
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
          description: string | null
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
          description?: string | null
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
          description?: string | null
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
      okr_key_result_updates: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          key_result_id: string
          new_value: number
          notes: string | null
          previous_value: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          key_result_id: string
          new_value: number
          notes?: string | null
          previous_value: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          key_result_id?: string
          new_value?: number
          notes?: string | null
          previous_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "okr_key_result_updates_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "okr_key_results"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_key_results: {
        Row: {
          created_at: string | null
          created_by: string | null
          current_value: number | null
          description: string | null
          id: string
          objective_id: string
          start_value: number | null
          status: string
          target_value: number
          title: string
          unit: string | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          objective_id: string
          start_value?: number | null
          status?: string
          target_value: number
          title: string
          unit?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          objective_id?: string
          start_value?: number | null
          status?: string
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "okr_key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_objectives: {
        Row: {
          area_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          level: string
          owner_id: string | null
          parent_id: string | null
          progress: number | null
          start_date: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          area_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          level?: string
          owner_id?: string | null
          parent_id?: string | null
          progress?: number | null
          start_date: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          area_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          level?: string
          owner_id?: string | null
          parent_id?: string | null
          progress?: number | null
          start_date?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "okr_objectives_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_objectives_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_objectives_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "okr_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      points_history: {
        Row: {
          action_type: string
          created_at: string | null
          description: string | null
          id: string
          points: number
          reference_id: string | null
          reference_type: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          points: number
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          points?: number
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      process_checklist_items: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          order_index: number
          process_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          order_index?: number
          process_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          order_index?: number
          process_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_checklist_items_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_execution_items: {
        Row: {
          checklist_item_id: string
          completed_at: string | null
          completed_by: string | null
          execution_id: string
          id: string
          is_completed: boolean
        }
        Insert: {
          checklist_item_id: string
          completed_at?: string | null
          completed_by?: string | null
          execution_id: string
          id?: string
          is_completed?: boolean
        }
        Update: {
          checklist_item_id?: string
          completed_at?: string | null
          completed_by?: string | null
          execution_id?: string
          id?: string
          is_completed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "process_execution_items_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "process_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_execution_items_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "process_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      process_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          executed_by: string | null
          id: string
          notes: string | null
          process_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          executed_by?: string | null
          id?: string
          notes?: string | null
          process_id: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          executed_by?: string | null
          id?: string
          notes?: string | null
          process_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_executions_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_responsibles: {
        Row: {
          created_at: string
          id: string
          process_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          process_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          process_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_responsibles_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          area_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          frequency: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processes_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      sales_daily: {
        Row: {
          company_id: string | null
          customers_served: number | null
          distributor_id: string | null
          external_id: string
          id: string
          product_category: string | null
          product_code: string | null
          product_name: string | null
          quantity: number | null
          sale_date: string
          synced_at: string | null
          total_value: number | null
        }
        Insert: {
          company_id?: string | null
          customers_served?: number | null
          distributor_id?: string | null
          external_id: string
          id?: string
          product_category?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          sale_date: string
          synced_at?: string | null
          total_value?: number | null
        }
        Update: {
          company_id?: string | null
          customers_served?: number | null
          distributor_id?: string | null
          external_id?: string
          id?: string
          product_category?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          sale_date?: string
          synced_at?: string | null
          total_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_daily_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_daily_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_sellers: {
        Row: {
          active_customers: number | null
          company_id: string | null
          distributor_id: string | null
          id: string
          sale_date: string
          seller_code: string
          seller_name: string | null
          synced_at: string | null
          total_customers: number | null
          total_value: number | null
        }
        Insert: {
          active_customers?: number | null
          company_id?: string | null
          distributor_id?: string | null
          id?: string
          sale_date: string
          seller_code: string
          seller_name?: string | null
          synced_at?: string | null
          total_customers?: number | null
          total_value?: number | null
        }
        Update: {
          active_customers?: number | null
          company_id?: string | null
          distributor_id?: string | null
          id?: string
          sale_date?: string
          seller_code?: string
          seller_name?: string | null
          synced_at?: string | null
          total_customers?: number | null
          total_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_sellers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_sellers_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          company_id: string | null
          completed_at: string | null
          errors: Json | null
          id: string
          records_created: number | null
          records_failed: number | null
          records_received: number | null
          records_updated: number | null
          started_at: string | null
          status: string | null
          sync_type: string
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          errors?: Json | null
          id?: string
          records_created?: number | null
          records_failed?: number | null
          records_received?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string | null
          sync_type: string
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          errors?: Json | null
          id?: string
          records_created?: number | null
          records_failed?: number | null
          records_received?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_company_id_fkey"
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
      two_factor_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          expires_at: string
          id: string
          method: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          method: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          method?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_companies: {
        Row: {
          all_companies: boolean | null
          can_view: boolean | null
          company_id: string | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          all_companies?: boolean | null
          can_view?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          all_companies?: boolean | null
          can_view?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
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
      user_points: {
        Row: {
          created_at: string | null
          id: string
          last_activity_date: string | null
          level: number
          points: number
          streak_days: number
          total_points_earned: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_activity_date?: string | null
          level?: number
          points?: number
          streak_days?: number
          total_points_earned?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_activity_date?: string | null
          level?: number
          points?: number
          streak_days?: number
          total_points_earned?: number
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
      add_user_points: {
        Args: {
          p_action_type: string
          p_description?: string
          p_points: number
          p_reference_id?: string
          p_reference_type?: string
          p_user_id: string
        }
        Returns: undefined
      }
      calculate_level: { Args: { total_points: number }; Returns: number }
      cleanup_expired_2fa_codes: { Args: never; Returns: undefined }
      count_convertible_employees: {
        Args: { p_company_id?: string }
        Returns: number
      }
      has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
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
      link_all_external_employees: { Args: never; Returns: number }
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
