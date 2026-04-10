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
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          hotel_id: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          hotel_id: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          hotel_id?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          hotel_id: string
          id: string
          payment_method: string | null
          recorded_by: string | null
          reference_id: string | null
          session_id: string | null
          source: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          hotel_id: string
          id?: string
          payment_method?: string | null
          recorded_by?: string | null
          reference_id?: string | null
          session_id?: string | null
          source: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          hotel_id?: string
          id?: string
          payment_method?: string | null
          recorded_by?: string | null
          reference_id?: string | null
          session_id?: string | null
          source?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_balance: number | null
          difference: number | null
          expected_balance: number | null
          hotel_id: string
          id: string
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          opening_balance: number
          status: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          difference?: number | null
          expected_balance?: number | null
          hotel_id: string
          id?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          opening_balance?: number
          status?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          difference?: number | null
          expected_balance?: number | null
          hotel_id?: string
          id?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          opening_balance?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string | null
          hotel_id: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          hotel_id: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          hotel_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          expense_date: string
          hotel_id: string
          id: string
          payment_method: string | null
          receipt_url: string | null
          recorded_by: string | null
          reference_number: string | null
          rejection_reason: string | null
          title: string
        }
        Insert: {
          amount: number
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          expense_date?: string
          hotel_id: string
          id?: string
          payment_method?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          reference_number?: string | null
          rejection_reason?: string | null
          title: string
        }
        Update: {
          amount?: number
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          expense_date?: string
          hotel_id?: string
          id?: string
          payment_method?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          reference_number?: string | null
          rejection_reason?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_feedback: {
        Row: {
          comment: string | null
          created_at: string | null
          guest_id: string | null
          hotel_id: string
          id: string
          rating: number | null
          room_id: string | null
          room_number: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          guest_id?: string | null
          hotel_id: string
          id?: string
          rating?: number | null
          room_id?: string | null
          room_number?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          guest_id?: string | null
          hotel_id?: string
          id?: string
          rating?: number | null
          room_id?: string | null
          room_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_feedback_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_feedback_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_feedback_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          arrangement: string | null
          check_in_date: string | null
          check_out_date: string | null
          coming_from: string | null
          country_of_residence: string | null
          created_at: string | null
          customer_signature_url: string | null
          date_of_birth: string | null
          email: string | null
          first_name: string
          gender: string | null
          going_to: string | null
          hotel_id: string
          id: string
          id_issued_at: string | null
          id_issued_on: string | null
          id_number: string | null
          id_type: string | null
          last_name: string
          maiden_name: string | null
          means_of_transport: string | null
          nationality: string | null
          notes: string | null
          number_of_adults: number | null
          number_of_children: number | null
          number_of_nights: number | null
          phone: string | null
          place_of_birth: string | null
          price_per_night: number | null
          profession: string | null
          receptionist_id: string | null
          receptionist_name: string | null
          room_id: string | null
          status: string | null
          total_price: number | null
          usual_address: string | null
        }
        Insert: {
          arrangement?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          coming_from?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          customer_signature_url?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          gender?: string | null
          going_to?: string | null
          hotel_id: string
          id?: string
          id_issued_at?: string | null
          id_issued_on?: string | null
          id_number?: string | null
          id_type?: string | null
          last_name: string
          maiden_name?: string | null
          means_of_transport?: string | null
          nationality?: string | null
          notes?: string | null
          number_of_adults?: number | null
          number_of_children?: number | null
          number_of_nights?: number | null
          phone?: string | null
          place_of_birth?: string | null
          price_per_night?: number | null
          profession?: string | null
          receptionist_id?: string | null
          receptionist_name?: string | null
          room_id?: string | null
          status?: string | null
          total_price?: number | null
          usual_address?: string | null
        }
        Update: {
          arrangement?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          coming_from?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          customer_signature_url?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          gender?: string | null
          going_to?: string | null
          hotel_id?: string
          id?: string
          id_issued_at?: string | null
          id_issued_on?: string | null
          id_number?: string | null
          id_type?: string | null
          last_name?: string
          maiden_name?: string | null
          means_of_transport?: string | null
          nationality?: string | null
          notes?: string | null
          number_of_adults?: number | null
          number_of_children?: number | null
          number_of_nights?: number | null
          phone?: string | null
          place_of_birth?: string | null
          price_per_night?: number | null
          profession?: string | null
          receptionist_id?: string | null
          receptionist_name?: string | null
          room_id?: string | null
          status?: string | null
          total_price?: number | null
          usual_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_receptionist_id_fkey"
            columns: ["receptionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          display_order: number | null
          hotel_id: string
          id: string
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          hotel_id: string
          id?: string
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          hotel_id?: string
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_photos_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_services: {
        Row: {
          created_at: string | null
          description: string | null
          hotel_id: string
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          hotel_id: string
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          hotel_id?: string
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_services_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_settings: {
        Row: {
          hotel_id: string
          key: string
          value: string | null
        }
        Insert: {
          hotel_id: string
          key: string
          value?: string | null
        }
        Update: {
          hotel_id?: string
          key?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_settings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          sieste_default_duration_hours: number | null
          sieste_overtime_rate_per_hour: number | null
          slug: string
          subscription_plan: string | null
          subscription_status: string | null
          timezone: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          sieste_default_duration_hours?: number | null
          sieste_overtime_rate_per_hour?: number | null
          slug: string
          subscription_plan?: string | null
          subscription_status?: string | null
          timezone?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          sieste_default_duration_hours?: number | null
          sieste_overtime_rate_per_hour?: number | null
          slug?: string
          subscription_plan?: string | null
          subscription_status?: string | null
          timezone?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      housekeeping_tasks: {
        Row: {
          assigned_to: string | null
          checklist: Json | null
          checklist_done: Json | null
          completed_at: string | null
          created_at: string | null
          hotel_id: string
          id: string
          notes: string | null
          room_id: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          assigned_to?: string | null
          checklist?: Json | null
          checklist_done?: Json | null
          completed_at?: string | null
          created_at?: string | null
          hotel_id: string
          id?: string
          notes?: string | null
          room_id: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          assigned_to?: string | null
          checklist?: Json | null
          checklist_done?: Json | null
          completed_at?: string | null
          created_at?: string | null
          hotel_id?: string
          id?: string
          notes?: string | null
          room_id?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_categories: {
        Row: {
          created_at: string | null
          hotel_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          hotel_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          hotel_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_categories_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          buying_price: number
          category_id: string | null
          created_at: string | null
          current_stock: number
          hotel_id: string
          id: string
          is_minibar: boolean | null
          minimum_stock: number | null
          name: string
          selling_price: number
          unit: string | null
        }
        Insert: {
          buying_price?: number
          category_id?: string | null
          created_at?: string | null
          current_stock?: number
          hotel_id: string
          id?: string
          is_minibar?: boolean | null
          minimum_stock?: number | null
          name: string
          selling_price?: number
          unit?: string | null
        }
        Update: {
          buying_price?: number
          category_id?: string | null
          created_at?: string | null
          current_stock?: number
          hotel_id?: string
          id?: string
          is_minibar?: boolean | null
          minimum_stock?: number | null
          name?: string
          selling_price?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string | null
          description: string
          hotel_id: string
          id: string
          invoice_id: string
          item_type: string | null
          quantity: number | null
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description: string
          hotel_id: string
          id?: string
          invoice_id: string
          item_type?: string | null
          quantity?: number | null
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          description?: string
          hotel_id?: string
          id?: string
          invoice_id?: string
          item_type?: string | null
          quantity?: number | null
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number | null
          balance_due: number | null
          created_at: string | null
          created_by: string | null
          guest_id: string | null
          hotel_id: string
          id: string
          invoice_number: string
          is_split: boolean | null
          notes: string | null
          parent_invoice_id: string | null
          reservation_id: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_percentage: number | null
          total_amount: number | null
        }
        Insert: {
          amount_paid?: number | null
          balance_due?: number | null
          created_at?: string | null
          created_by?: string | null
          guest_id?: string | null
          hotel_id: string
          id?: string
          invoice_number: string
          is_split?: boolean | null
          notes?: string | null
          parent_invoice_id?: string | null
          reservation_id?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_percentage?: number | null
          total_amount?: number | null
        }
        Update: {
          amount_paid?: number | null
          balance_due?: number | null
          created_at?: string | null
          created_by?: string | null
          guest_id?: string | null
          hotel_id?: string
          id?: string
          invoice_number?: string
          is_split?: boolean | null
          notes?: string | null
          parent_invoice_id?: string | null
          reservation_id?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_percentage?: number | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      main_courante: {
        Row: {
          a_reporter: number | null
          bar: number | null
          ca_total_jour: number | null
          created_at: string | null
          day_closed: boolean | null
          deduction: number | null
          divers: number | null
          encaissement: number | null
          guest_id: string | null
          hebergement: number | null
          hotel_id: string
          id: string
          is_manual: boolean | null
          journee: string
          nom_client: string
          nombre_personnes: number | null
          observation: string | null
          report_veille: number | null
          restaurant: number | null
          room_id: string | null
          room_number: string | null
          updated_at: string | null
        }
        Insert: {
          a_reporter?: number | null
          bar?: number | null
          ca_total_jour?: number | null
          created_at?: string | null
          day_closed?: boolean | null
          deduction?: number | null
          divers?: number | null
          encaissement?: number | null
          guest_id?: string | null
          hebergement?: number | null
          hotel_id: string
          id?: string
          is_manual?: boolean | null
          journee?: string
          nom_client: string
          nombre_personnes?: number | null
          observation?: string | null
          report_veille?: number | null
          restaurant?: number | null
          room_id?: string | null
          room_number?: string | null
          updated_at?: string | null
        }
        Update: {
          a_reporter?: number | null
          bar?: number | null
          ca_total_jour?: number | null
          created_at?: string | null
          day_closed?: boolean | null
          deduction?: number | null
          divers?: number | null
          encaissement?: number | null
          guest_id?: string | null
          hebergement?: number | null
          hotel_id?: string
          id?: string
          is_manual?: boolean | null
          journee?: string
          nom_client?: string
          nombre_personnes?: number | null
          observation?: string | null
          report_veille?: number | null
          restaurant?: number | null
          room_id?: string | null
          room_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "main_courante_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "main_courante_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "main_courante_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          hotel_id: string
          id: string
          message: string
          read: boolean | null
          related_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          hotel_id: string
          id?: string
          message: string
          read?: boolean | null
          related_id?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          hotel_id?: string
          id?: string
          message?: string
          read?: boolean | null
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          hotel_id: string
          id: string
          invoice_id: string
          notes: string | null
          payment_method: string | null
          recorded_by: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          hotel_id: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_method?: string | null
          recorded_by?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          hotel_id?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_method?: string | null
          recorded_by?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          disabled: boolean | null
          email: string | null
          full_name: string | null
          hotel_id: string | null
          id: string
          is_hotel_owner: boolean | null
          is_super_admin: boolean | null
          phone: string | null
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          disabled?: boolean | null
          email?: string | null
          full_name?: string | null
          hotel_id?: string | null
          id: string
          is_hotel_owner?: boolean | null
          is_super_admin?: boolean | null
          phone?: string | null
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          disabled?: boolean | null
          email?: string | null
          full_name?: string | null
          hotel_id?: string | null
          id?: string
          is_hotel_owner?: boolean | null
          is_super_admin?: boolean | null
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          check_in_date: string
          check_out_date: string
          created_at: string | null
          created_by: string | null
          deposit_paid: number | null
          guest_email: string | null
          guest_name: string
          guest_phone: string | null
          hotel_id: string
          id: string
          number_of_adults: number | null
          number_of_children: number | null
          number_of_nights: number | null
          payment_method_cash: boolean | null
          payment_method_momo: boolean | null
          payment_method_om: boolean | null
          reservation_number: string
          room_id: string | null
          room_type_id: string | null
          source: string | null
          special_requests: string | null
          status: string | null
          total_price: number | null
        }
        Insert: {
          check_in_date: string
          check_out_date: string
          created_at?: string | null
          created_by?: string | null
          deposit_paid?: number | null
          guest_email?: string | null
          guest_name: string
          guest_phone?: string | null
          hotel_id: string
          id?: string
          number_of_adults?: number | null
          number_of_children?: number | null
          number_of_nights?: number | null
          payment_method_cash?: boolean | null
          payment_method_momo?: boolean | null
          payment_method_om?: boolean | null
          reservation_number: string
          room_id?: string | null
          room_type_id?: string | null
          source?: string | null
          special_requests?: string | null
          status?: string | null
          total_price?: number | null
        }
        Update: {
          check_in_date?: string
          check_out_date?: string
          created_at?: string | null
          created_by?: string | null
          deposit_paid?: number | null
          guest_email?: string | null
          guest_name?: string
          guest_phone?: string | null
          hotel_id?: string
          id?: string
          number_of_adults?: number | null
          number_of_children?: number | null
          number_of_nights?: number | null
          payment_method_cash?: boolean | null
          payment_method_momo?: boolean | null
          payment_method_om?: boolean | null
          reservation_number?: string
          room_id?: string | null
          room_type_id?: string | null
          source?: string | null
          special_requests?: string | null
          status?: string | null
          total_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_categories: {
        Row: {
          created_at: string | null
          display_order: number | null
          hotel_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          hotel_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          hotel_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_categories_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_items: {
        Row: {
          available: boolean | null
          category_id: string | null
          created_at: string | null
          description: string | null
          hotel_id: string
          id: string
          inventory_item_id: string | null
          name: string
          price: number
        }
        Insert: {
          available?: boolean | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          hotel_id: string
          id?: string
          inventory_item_id?: string | null
          name: string
          price: number
        }
        Update: {
          available?: boolean | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          hotel_id?: string
          id?: string
          inventory_item_id?: string | null
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "restaurant_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_order_items: {
        Row: {
          hotel_id: string
          id: string
          item_id: string
          order_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          hotel_id: string
          id?: string
          item_id: string
          order_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          hotel_id?: string
          id?: string
          item_id?: string
          order_id?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_order_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "restaurant_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "restaurant_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_orders: {
        Row: {
          approved_by: string | null
          billed_to_room: boolean | null
          created_at: string | null
          created_by: string | null
          delivered_at: string | null
          guest_id: string | null
          hotel_id: string
          id: string
          invoice_id: string | null
          is_walkin: boolean | null
          notes: string | null
          order_number: string
          ready_at: string | null
          room_id: string | null
          started_at: string | null
          status: string | null
          total_amount: number | null
          walkin_name: string | null
          walkin_table: string | null
        }
        Insert: {
          approved_by?: string | null
          billed_to_room?: boolean | null
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          guest_id?: string | null
          hotel_id: string
          id?: string
          invoice_id?: string | null
          is_walkin?: boolean | null
          notes?: string | null
          order_number: string
          ready_at?: string | null
          room_id?: string | null
          started_at?: string | null
          status?: string | null
          total_amount?: number | null
          walkin_name?: string | null
          walkin_table?: string | null
        }
        Update: {
          approved_by?: string | null
          billed_to_room?: boolean | null
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          guest_id?: string | null
          hotel_id?: string
          id?: string
          invoice_id?: string | null
          is_walkin?: boolean | null
          notes?: string | null
          order_number?: string
          ready_at?: string | null
          room_id?: string | null
          started_at?: string | null
          status?: string | null
          total_amount?: number | null
          walkin_name?: string | null
          walkin_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_orders_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_orders_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_orders_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          base_price: number
          created_at: string | null
          description: string | null
          hotel_id: string
          id: string
          name: string
        }
        Insert: {
          base_price?: number
          created_at?: string | null
          description?: string | null
          hotel_id: string
          id?: string
          name: string
        }
        Update: {
          base_price?: number
          created_at?: string | null
          description?: string | null
          hotel_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_types_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number | null
          created_at: string | null
          description: string | null
          features: string[] | null
          floor: number | null
          hotel_id: string
          id: string
          is_minibar: boolean | null
          portal_visible: boolean | null
          price_per_night: number
          room_number: string
          room_type_id: string | null
          status: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          description?: string | null
          features?: string[] | null
          floor?: number | null
          hotel_id: string
          id?: string
          is_minibar?: boolean | null
          portal_visible?: boolean | null
          price_per_night?: number
          room_number: string
          room_type_id?: string | null
          status?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          description?: string | null
          features?: string[] | null
          floor?: number | null
          hotel_id?: string
          id?: string
          is_minibar?: boolean | null
          portal_visible?: boolean | null
          price_per_night?: number
          room_number?: string
          room_type_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          created_at: string | null
          description: string | null
          hotel_id: string
          id: string
          request_type: string
          room_id: string | null
          room_number: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          hotel_id: string
          id?: string
          request_type: string
          room_id?: string | null
          room_number?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          hotel_id?: string
          id?: string
          request_type?: string
          room_id?: string | null
          room_number?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      siestes: {
        Row: {
          amount_paid: number | null
          arrival_date: string
          arrival_time: string
          created_at: string | null
          date_of_birth: string | null
          departure_date: string | null
          departure_time: string | null
          duration_hours: number | null
          full_name: string
          hotel_id: string
          id: string
          id_issued_on: string | null
          id_number: string | null
          invoice_id: string | null
          nationality: string | null
          notes: string | null
          order_number: number | null
          overtime_charged: boolean | null
          overtime_hours: number | null
          payment_method: string | null
          phone: string | null
          profession: string | null
          recorded_by: string | null
          room_id: string | null
        }
        Insert: {
          amount_paid?: number | null
          arrival_date?: string
          arrival_time: string
          created_at?: string | null
          date_of_birth?: string | null
          departure_date?: string | null
          departure_time?: string | null
          duration_hours?: number | null
          full_name: string
          hotel_id: string
          id?: string
          id_issued_on?: string | null
          id_number?: string | null
          invoice_id?: string | null
          nationality?: string | null
          notes?: string | null
          order_number?: number | null
          overtime_charged?: boolean | null
          overtime_hours?: number | null
          payment_method?: string | null
          phone?: string | null
          profession?: string | null
          recorded_by?: string | null
          room_id?: string | null
        }
        Update: {
          amount_paid?: number | null
          arrival_date?: string
          arrival_time?: string
          created_at?: string | null
          date_of_birth?: string | null
          departure_date?: string | null
          departure_time?: string | null
          duration_hours?: number | null
          full_name?: string
          hotel_id?: string
          id?: string
          id_issued_on?: string | null
          id_number?: string | null
          invoice_id?: string | null
          nationality?: string | null
          notes?: string | null
          order_number?: number | null
          overtime_charged?: boolean | null
          overtime_hours?: number | null
          payment_method?: string | null
          phone?: string | null
          profession?: string | null
          recorded_by?: string | null
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "siestes_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siestes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siestes_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siestes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_entries: {
        Row: {
          buying_price: number
          created_at: string | null
          hotel_id: string
          id: string
          item_id: string
          notes: string | null
          quantity: number
          recorded_by: string | null
          supplier: string | null
        }
        Insert: {
          buying_price: number
          created_at?: string | null
          hotel_id: string
          id?: string
          item_id: string
          notes?: string | null
          quantity: number
          recorded_by?: string | null
          supplier?: string | null
        }
        Update: {
          buying_price?: number
          created_at?: string | null
          hotel_id?: string
          id?: string
          item_id?: string
          notes?: string | null
          quantity?: number
          recorded_by?: string | null
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_entries_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string | null
          hotel_id: string
          id: string
          item_id: string
          movement_type: string | null
          quantity: number
          reference_id: string | null
          source: string | null
        }
        Insert: {
          created_at?: string | null
          hotel_id: string
          id?: string
          item_id: string
          movement_type?: string | null
          quantity: number
          reference_id?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string | null
          hotel_id?: string
          id?: string
          item_id?: string
          movement_type?: string | null
          quantity?: number
          reference_id?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_hotel_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      is_super_admin: { Args: never; Returns: boolean }
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
