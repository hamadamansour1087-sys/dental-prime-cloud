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
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          lab_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          lab_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          lab_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      case_attachments: {
        Row: {
          case_id: string
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          kind: string
          lab_id: string
          mime_type: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          kind?: string
          lab_id: string
          mime_type?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          kind?: string
          lab_id?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_attachments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_attachments_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      case_items: {
        Row: {
          case_id: string
          created_at: string
          id: string
          lab_id: string
          notes: string | null
          position: number
          shade: string | null
          tooth_numbers: string | null
          total_price: number | null
          unit_price: number | null
          units: number
          updated_at: string
          work_type_id: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          lab_id: string
          notes?: string | null
          position?: number
          shade?: string | null
          tooth_numbers?: string | null
          total_price?: number | null
          unit_price?: number | null
          units?: number
          updated_at?: string
          work_type_id?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          lab_id?: string
          notes?: string | null
          position?: number
          shade?: string | null
          tooth_numbers?: string | null
          total_price?: number | null
          unit_price?: number | null
          units?: number
          updated_at?: string
          work_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_items_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_items_work_type_id_fkey"
            columns: ["work_type_id"]
            isOneToOne: false
            referencedRelation: "work_types"
            referencedColumns: ["id"]
          },
        ]
      }
      case_stage_history: {
        Row: {
          case_id: string
          duration_minutes: number | null
          entered_at: string
          entered_by: string | null
          exited_at: string | null
          id: string
          lab_id: string
          notes: string | null
          skipped: boolean
          stage_id: string | null
          technician_id: string | null
        }
        Insert: {
          case_id: string
          duration_minutes?: number | null
          entered_at?: string
          entered_by?: string | null
          exited_at?: string | null
          id?: string
          lab_id: string
          notes?: string | null
          skipped?: boolean
          stage_id?: string | null
          technician_id?: string | null
        }
        Update: {
          case_id?: string
          duration_minutes?: number | null
          entered_at?: string
          entered_by?: string | null
          exited_at?: string | null
          id?: string
          lab_id?: string
          notes?: string | null
          skipped?: boolean
          stage_id?: string | null
          technician_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_stage_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_stage_history_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_stage_history_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_stage_history_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          case_number: string
          created_at: string
          created_by: string | null
          current_stage_id: string | null
          date_delivered: string | null
          date_received: string
          doctor_id: string | null
          due_date: string | null
          id: string
          lab_id: string
          notes: string | null
          patient_id: string | null
          price: number | null
          shade: string | null
          stage_entered_at: string | null
          status: Database["public"]["Enums"]["case_status"]
          tooth_numbers: string | null
          units: number | null
          updated_at: string
          work_type_id: string | null
          workflow_id: string | null
        }
        Insert: {
          case_number: string
          created_at?: string
          created_by?: string | null
          current_stage_id?: string | null
          date_delivered?: string | null
          date_received?: string
          doctor_id?: string | null
          due_date?: string | null
          id?: string
          lab_id: string
          notes?: string | null
          patient_id?: string | null
          price?: number | null
          shade?: string | null
          stage_entered_at?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          tooth_numbers?: string | null
          units?: number | null
          updated_at?: string
          work_type_id?: string | null
          workflow_id?: string | null
        }
        Update: {
          case_number?: string
          created_at?: string
          created_by?: string | null
          current_stage_id?: string | null
          date_delivered?: string | null
          date_received?: string
          doctor_id?: string | null
          due_date?: string | null
          id?: string
          lab_id?: string
          notes?: string | null
          patient_id?: string | null
          price?: number | null
          shade?: string | null
          stage_entered_at?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          tooth_numbers?: string | null
          units?: number | null
          updated_at?: string
          work_type_id?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_work_type_id_fkey"
            columns: ["work_type_id"]
            isOneToOne: false
            referencedRelation: "work_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_clinics: {
        Row: {
          address: string | null
          created_at: string
          doctor_id: string
          id: string
          is_primary: boolean
          lab_id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          doctor_id: string
          id?: string
          is_primary?: boolean
          lab_id: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          doctor_id?: string
          id?: string
          is_primary?: boolean
          lab_id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_clinics_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_clinics_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          address: string | null
          clinic_name: string | null
          created_at: string
          email: string | null
          governorate: string | null
          id: string
          is_active: boolean
          lab_id: string
          name: string
          notes: string | null
          opening_balance: number
          phone: string | null
          portal_enabled: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          clinic_name?: string | null
          created_at?: string
          email?: string | null
          governorate?: string | null
          id?: string
          is_active?: boolean
          lab_id: string
          name: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          portal_enabled?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          clinic_name?: string | null
          created_at?: string
          email?: string | null
          governorate?: string | null
          id?: string
          is_active?: boolean
          lab_id?: string
          name?: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          portal_enabled?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      labs: {
        Row: {
          address: string | null
          case_number_prefix: string
          case_number_seq: number
          code: string | null
          created_at: string
          currency: string
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          case_number_prefix?: string
          case_number_seq?: number
          code?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          case_number_prefix?: string
          case_number_seq?: number
          code?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          age: number | null
          created_at: string
          gender: string | null
          id: string
          lab_id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          created_at?: string
          gender?: string | null
          id?: string
          lab_id: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          created_at?: string
          gender?: string | null
          id?: string
          lab_id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          doctor_id: string
          id: string
          lab_id: string
          method: string | null
          notes: string | null
          payment_date: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          doctor_id: string
          id?: string
          lab_id: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          doctor_id?: string
          id?: string
          lab_id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          id: string
          module: string
          name_ar: string
          name_en: string
        }
        Insert: {
          action: string
          id?: string
          module: string
          name_ar: string
          name_en: string
        }
        Update: {
          action?: string
          id?: string
          module?: string
          name_ar?: string
          name_en?: string
        }
        Relationships: []
      }
      price_lists: {
        Row: {
          created_at: string
          doctor_id: string | null
          governorate: string | null
          id: string
          is_active: boolean
          lab_id: string
          notes: string | null
          price: number
          updated_at: string
          work_type_id: string
        }
        Insert: {
          created_at?: string
          doctor_id?: string | null
          governorate?: string | null
          id?: string
          is_active?: boolean
          lab_id: string
          notes?: string | null
          price: number
          updated_at?: string
          work_type_id: string
        }
        Update: {
          created_at?: string
          doctor_id?: string | null
          governorate?: string | null
          id?: string
          is_active?: boolean
          lab_id?: string
          notes?: string | null
          price?: number
          updated_at?: string
          work_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_lists_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_lists_work_type_id_fkey"
            columns: ["work_type_id"]
            isOneToOne: false
            referencedRelation: "work_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          lab_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          lab_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          lab_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          lab_id: string | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          lab_id?: string | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          lab_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          lab_id: string
          name: string
          notes: string | null
          phone: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          lab_id: string
          name: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          lab_id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technicians_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          lab_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lab_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lab_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      work_types: {
        Row: {
          created_at: string
          default_price: number | null
          description: string | null
          id: string
          is_active: boolean
          lab_id: string
          name: string
        }
        Insert: {
          created_at?: string
          default_price?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          lab_id: string
          name: string
        }
        Update: {
          created_at?: string
          default_price?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          lab_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_types_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_stages: {
        Row: {
          code: string
          color: string
          created_at: string
          estimated_days: number | null
          id: string
          is_end: boolean
          is_start: boolean
          lab_id: string
          name: string
          notify_doctor: boolean
          order_index: number
          workflow_id: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          estimated_days?: number | null
          id?: string
          is_end?: boolean
          is_start?: boolean
          lab_id: string
          name: string
          notify_doctor?: boolean
          order_index: number
          workflow_id: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          estimated_days?: number | null
          id?: string
          is_end?: boolean
          is_start?: boolean
          lab_id?: string
          name?: string
          notify_doctor?: boolean
          order_index?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_stages_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_stages_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_transitions: {
        Row: {
          from_stage_id: string
          id: string
          lab_id: string
          to_stage_id: string
          workflow_id: string
        }
        Insert: {
          from_stage_id: string
          id?: string
          lab_id: string
          to_stage_id: string
          workflow_id: string
        }
        Update: {
          from_stage_id?: string
          id?: string
          lab_id?: string
          to_stage_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_transitions_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          lab_id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          lab_id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          lab_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_workflow_stage: {
        Args: {
          _color?: string
          _estimated_days?: number
          _name: string
          _notify_doctor?: boolean
          _order_index?: number
          _workflow_id: string
        }
        Returns: string
      }
      approve_pending_case: {
        Args: { _case_id: string; _workflow_id?: string }
        Returns: string
      }
      create_workflow: {
        Args: { _description?: string; _name: string }
        Returns: string
      }
      current_doctor_id: { Args: never; Returns: string }
      current_doctor_lab_id: { Args: never; Returns: string }
      current_lab_id: { Args: never; Returns: string }
      delete_workflow: {
        Args: { _force?: boolean; _workflow_id: string }
        Returns: undefined
      }
      delete_workflow_stage: { Args: { _stage_id: string }; Returns: undefined }
      generate_case_number: { Args: { _lab_id: string }; Returns: string }
      has_role: {
        Args: {
          _lab_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_lab_admin: { Args: { _lab_id: string }; Returns: boolean }
      is_lab_manager_or_admin: { Args: { _lab_id: string }; Returns: boolean }
      is_lab_member: { Args: { _lab_id: string }; Returns: boolean }
      reject_pending_case: {
        Args: { _case_id: string; _reason?: string }
        Returns: undefined
      }
      reorder_workflow_stages: {
        Args: { _ordered_stage_ids: string[]; _workflow_id: string }
        Returns: undefined
      }
      resolve_case_price: {
        Args: { _doctor_id: string; _lab_id: string; _work_type_id: string }
        Returns: number
      }
      set_default_workflow: {
        Args: { _workflow_id: string }
        Returns: undefined
      }
      transition_case_stage: {
        Args: {
          _case_id: string
          _notes?: string
          _skipped_stage_ids?: string[]
          _technician_id?: string
          _to_stage_id: string
        }
        Returns: undefined
      }
      update_workflow: {
        Args: {
          _description?: string
          _is_active?: boolean
          _name: string
          _workflow_id: string
        }
        Returns: undefined
      }
      update_workflow_stage: {
        Args: {
          _color?: string
          _estimated_days?: number
          _name?: string
          _notify_doctor?: boolean
          _stage_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "technician" | "doctor"
      case_status:
        | "active"
        | "on_hold"
        | "delivered"
        | "cancelled"
        | "pending_approval"
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
      app_role: ["admin", "manager", "technician", "doctor"],
      case_status: [
        "active",
        "on_hold",
        "delivered",
        "cancelled",
        "pending_approval",
      ],
    },
  },
} as const
