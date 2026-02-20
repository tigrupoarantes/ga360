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
          cost_center: string | null
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          cost_center?: string | null
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          cost_center?: string | null
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
          accounting_group_code: string | null
          accounting_group_description: string | null
          address: string | null
          cnpj: string | null
          color: string | null
          created_at: string
          email: string | null
          external_id: string | null
          id: string
          is_active: boolean
          is_auditable: boolean | null
          logo_url: string | null
          name: string
          phone: string | null
          razao_social: string | null
          updated_at: string
        }
        Insert: {
          accounting_group_code?: string | null
          accounting_group_description?: string | null
          address?: string | null
          cnpj?: string | null
          color?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          is_active?: boolean
          is_auditable?: boolean | null
          logo_url?: string | null
          name: string
          phone?: string | null
          razao_social?: string | null
          updated_at?: string
        }
        Update: {
          accounting_group_code?: string | null
          accounting_group_description?: string | null
          address?: string | null
          cnpj?: string | null
          color?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          is_active?: boolean
          is_auditable?: boolean | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          razao_social?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dl_card_bindings: {
        Row: {
          cache_ttl_minutes: number | null
          card_id: string
          created_at: string
          id: string
          is_enabled: boolean
          mapping_json: Json | null
          params_mapping_json: Json | null
          query_id: string
          refresh_policy: string
          updated_at: string
        }
        Insert: {
          cache_ttl_minutes?: number | null
          card_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          mapping_json?: Json | null
          params_mapping_json?: Json | null
          query_id: string
          refresh_policy?: string
          updated_at?: string
        }
        Update: {
          cache_ttl_minutes?: number | null
          card_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          mapping_json?: Json | null
          params_mapping_json?: Json | null
          query_id?: string
          refresh_policy?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dl_card_bindings_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "ec_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dl_card_bindings_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "dl_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      dl_connections: {
        Row: {
          auth_config_json: Json | null
          auth_type: string | null
          base_url: string
          created_at: string
          created_by: string | null
          headers_json: Json | null
          id: string
          is_enabled: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          auth_config_json?: Json | null
          auth_type?: string | null
          base_url: string
          created_at?: string
          created_by?: string | null
          headers_json?: Json | null
          id?: string
          is_enabled?: boolean
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          auth_config_json?: Json | null
          auth_type?: string | null
          base_url?: string
          created_at?: string
          created_by?: string | null
          headers_json?: Json | null
          id?: string
          is_enabled?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dl_connections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dl_queries: {
        Row: {
          body_template_json: Json | null
          connection_id: string
          created_at: string
          description: string | null
          endpoint_path: string
          id: string
          is_enabled: boolean
          method: string
          name: string
          outputs_schema_json: Json | null
          params_schema_json: Json | null
          updated_at: string
        }
        Insert: {
          body_template_json?: Json | null
          connection_id: string
          created_at?: string
          description?: string | null
          endpoint_path: string
          id?: string
          is_enabled?: boolean
          method?: string
          name: string
          outputs_schema_json?: Json | null
          params_schema_json?: Json | null
          updated_at?: string
        }
        Update: {
          body_template_json?: Json | null
          connection_id?: string
          created_at?: string
          description?: string | null
          endpoint_path?: string
          id?: string
          is_enabled?: boolean
          method?: string
          name?: string
          outputs_schema_json?: Json | null
          params_schema_json?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dl_queries_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "dl_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      dl_query_runs: {
        Row: {
          binding_id: string | null
          card_id: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          params_used_json: Json | null
          query_id: string
          response_snapshot_json: Json | null
          rows_returned: number | null
          started_at: string
          status: string
        }
        Insert: {
          binding_id?: string | null
          card_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          params_used_json?: Json | null
          query_id: string
          response_snapshot_json?: Json | null
          rows_returned?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          binding_id?: string | null
          card_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          params_used_json?: Json | null
          query_id?: string
          response_snapshot_json?: Json | null
          rows_returned?: number | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dl_query_runs_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: false
            referencedRelation: "dl_card_bindings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dl_query_runs_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "ec_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dl_query_runs_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "dl_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      ec_areas: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          order: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          order?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          order?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ec_card_permissions: {
        Row: {
          can_fill: boolean
          can_manage: boolean
          can_review: boolean
          can_view: boolean
          card_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_fill?: boolean
          can_manage?: boolean
          can_review?: boolean
          can_view?: boolean
          card_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_fill?: boolean
          can_manage?: boolean
          can_review?: boolean
          can_view?: boolean
          card_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ec_card_permissions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "ec_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      ec_card_records: {
        Row: {
          card_id: string
          checklist_json: Json | null
          competence: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          datalake_snapshot_json: Json | null
          due_date: string | null
          id: string
          manual_payload_json: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          card_id: string
          checklist_json?: Json | null
          competence: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          datalake_snapshot_json?: Json | null
          due_date?: string | null
          id?: string
          manual_payload_json?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          card_id?: string
          checklist_json?: Json | null
          competence?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          datalake_snapshot_json?: Json | null
          due_date?: string | null
          id?: string
          manual_payload_json?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ec_card_records_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "ec_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ec_card_records_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ec_card_records_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ec_card_tasks: {
        Row: {
          assignee_id: string | null
          card_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          record_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          card_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          record_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          card_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          record_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ec_card_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ec_card_tasks_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "ec_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ec_card_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ec_card_tasks_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "ec_card_records"
            referencedColumns: ["id"]
          },
        ]
      }
      ec_cards: {
        Row: {
          area_id: string
          backup_id: string | null
          checklist_template_json: Json | null
          created_at: string
          description: string | null
          due_rule_json: Json | null
          id: string
          is_active: boolean
          manual_fields_schema_json: Json | null
          order: number
          periodicity_type: string
          required_evidences_json: Json | null
          responsible_id: string | null
          risk_days_threshold: number | null
          scope_json: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          area_id: string
          backup_id?: string | null
          checklist_template_json?: Json | null
          created_at?: string
          description?: string | null
          due_rule_json?: Json | null
          id?: string
          is_active?: boolean
          manual_fields_schema_json?: Json | null
          order?: number
          periodicity_type?: string
          required_evidences_json?: Json | null
          responsible_id?: string | null
          risk_days_threshold?: number | null
          scope_json?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          area_id?: string
          backup_id?: string | null
          checklist_template_json?: Json | null
          created_at?: string
          description?: string | null
          due_rule_json?: Json | null
          id?: string
          is_active?: boolean
          manual_fields_schema_json?: Json | null
          order?: number
          periodicity_type?: string
          required_evidences_json?: Json | null
          responsible_id?: string | null
          risk_days_threshold?: number | null
          scope_json?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ec_cards_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "ec_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ec_cards_backup_id_fkey"
            columns: ["backup_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ec_cards_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ec_record_comments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          record_id: string
          text: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          record_id: string
          text: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          record_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "ec_record_comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ec_record_comments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "ec_card_records"
            referencedColumns: ["id"]
          },
        ]
      }
      ec_record_evidences: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          file_path: string | null
          id: string
          record_id: string
          type: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          record_id: string
          type?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          record_id?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ec_record_evidences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ec_record_evidences_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "ec_card_records"
            referencedColumns: ["id"]
          },
        ]
      }
      external_employees: {
        Row: {
          cnh_categoria: string | null
          cnh_numero: string | null
          cnh_validade: string | null
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
          cnh_categoria?: string | null
          cnh_numero?: string | null
          cnh_validade?: string | null
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
          cnh_categoria?: string | null
          cnh_numero?: string | null
          cnh_validade?: string | null
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
      stock_audit_item_photos: {
        Row: {
          created_at: string | null
          id: string
          photo_url: string
          stock_audit_item_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          photo_url: string
          stock_audit_item_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          photo_url?: string
          stock_audit_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_audit_item_photos_stock_audit_item_id_fkey"
            columns: ["stock_audit_item_id"]
            isOneToOne: false
            referencedRelation: "stock_audit_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_audit_items: {
        Row: {
          audited_at: string | null
          created_at: string | null
          final_diff_qty: number | null
          final_physical_qty: number | null
          id: string
          is_in_sample: boolean | null
          item_notes: string | null
          location: string | null
          physical_qty: number | null
          recount_qty: number | null
          result: string | null
          root_cause_code: string | null
          root_cause_notes: string | null
          sku_code: string
          sku_description: string | null
          stock_audit_id: string
          system_qty: number
          uom: string | null
        }
        Insert: {
          audited_at?: string | null
          created_at?: string | null
          final_diff_qty?: number | null
          final_physical_qty?: number | null
          id?: string
          is_in_sample?: boolean | null
          item_notes?: string | null
          location?: string | null
          physical_qty?: number | null
          recount_qty?: number | null
          result?: string | null
          root_cause_code?: string | null
          root_cause_notes?: string | null
          sku_code: string
          sku_description?: string | null
          stock_audit_id: string
          system_qty: number
          uom?: string | null
        }
        Update: {
          audited_at?: string | null
          created_at?: string | null
          final_diff_qty?: number | null
          final_physical_qty?: number | null
          id?: string
          is_in_sample?: boolean | null
          item_notes?: string | null
          location?: string | null
          physical_qty?: number | null
          recount_qty?: number | null
          result?: string | null
          root_cause_code?: string | null
          root_cause_notes?: string | null
          sku_code?: string
          sku_description?: string | null
          stock_audit_id?: string
          system_qty?: number
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_audit_items_stock_audit_id_fkey"
            columns: ["stock_audit_id"]
            isOneToOne: false
            referencedRelation: "stock_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_audit_settings: {
        Row: {
          cc_emails: Json | null
          company_id: string | null
          created_at: string | null
          default_blind_count_enabled: boolean | null
          default_sample_size: number | null
          default_tolerance_abs: number | null
          default_tolerance_pct: number | null
          governance_email: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          cc_emails?: Json | null
          company_id?: string | null
          created_at?: string | null
          default_blind_count_enabled?: boolean | null
          default_sample_size?: number | null
          default_tolerance_abs?: number | null
          default_tolerance_pct?: number | null
          governance_email?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          cc_emails?: Json | null
          company_id?: string | null
          created_at?: string | null
          default_blind_count_enabled?: boolean | null
          default_sample_size?: number | null
          default_tolerance_abs?: number | null
          default_tolerance_pct?: number | null
          governance_email?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_audit_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_audits: {
        Row: {
          auditor_user_id: string
          base_file_meta: Json | null
          base_file_type: string | null
          base_file_url: string | null
          blind_count_enabled: boolean | null
          card_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string | null
          cutoff_datetime: string | null
          executed_date: string | null
          id: string
          movement_during_audit: boolean | null
          movement_notes: string | null
          planned_date: string | null
          report_html: string | null
          report_sent_at: string | null
          report_sent_to: string[] | null
          sample_size: number | null
          sampling_method: string | null
          status: string | null
          total_items_loaded: number | null
          unit_id: string
          updated_at: string | null
          witness_cpf: string | null
          witness_name: string | null
          witness_term_accepted: boolean | null
        }
        Insert: {
          auditor_user_id: string
          base_file_meta?: Json | null
          base_file_type?: string | null
          base_file_url?: string | null
          blind_count_enabled?: boolean | null
          card_id?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          cutoff_datetime?: string | null
          executed_date?: string | null
          id?: string
          movement_during_audit?: boolean | null
          movement_notes?: string | null
          planned_date?: string | null
          report_html?: string | null
          report_sent_at?: string | null
          report_sent_to?: string[] | null
          sample_size?: number | null
          sampling_method?: string | null
          status?: string | null
          total_items_loaded?: number | null
          unit_id: string
          updated_at?: string | null
          witness_cpf?: string | null
          witness_name?: string | null
          witness_term_accepted?: boolean | null
        }
        Update: {
          auditor_user_id?: string
          base_file_meta?: Json | null
          base_file_type?: string | null
          base_file_url?: string | null
          blind_count_enabled?: boolean | null
          card_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          cutoff_datetime?: string | null
          executed_date?: string | null
          id?: string
          movement_during_audit?: boolean | null
          movement_notes?: string | null
          planned_date?: string | null
          report_html?: string | null
          report_sent_at?: string | null
          report_sent_to?: string[] | null
          sample_size?: number | null
          sampling_method?: string | null
          status?: string | null
          total_items_loaded?: number | null
          unit_id?: string
          updated_at?: string | null
          witness_cpf?: string | null
          witness_name?: string | null
          witness_term_accepted?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_audits_auditor_user_id_fkey"
            columns: ["auditor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_audits_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "ec_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_audits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_audits_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      has_card_permission: {
        Args: { _card_id: string; _permission: string; _user_id: string }
        Returns: boolean
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
        | "governanca"
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
        "governanca",
      ],
    },
  },
} as const
