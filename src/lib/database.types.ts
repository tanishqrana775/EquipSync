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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          institution_id: string | null
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          institution_id?: string | null
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          institution_id?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_at: string
          id: string
          institution_id: string
          purpose: string | null
          resource_id: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          supervisor_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_at: string
          id?: string
          institution_id: string
          purpose?: string | null
          resource_id: string
          start_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          supervisor_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_at?: string
          id?: string
          institution_id?: string
          purpose?: string | null
          resource_id?: string
          start_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          supervisor_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_utilisation"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custody_events: {
        Row: {
          accessory_checks: Json
          actor_id: string
          booking_id: string
          condition: Database["public"]["Enums"]["condition_rating"]
          created_at: string
          id: string
          notes: string | null
          phase: Database["public"]["Enums"]["custody_phase"]
          qr_verified: boolean
          flagged: boolean
          flag_reasons: string[]
        }
        Insert: {
          accessory_checks?: Json
          actor_id: string
          booking_id: string
          condition: Database["public"]["Enums"]["condition_rating"]
          created_at?: string
          id?: string
          notes?: string | null
          phase: Database["public"]["Enums"]["custody_phase"]
          qr_verified?: boolean
          flagged?: boolean
          flag_reasons?: string[]
        }
        Update: {
          accessory_checks?: Json
          actor_id?: string
          booking_id?: string
          condition?: Database["public"]["Enums"]["condition_rating"]
          created_at?: string
          id?: string
          notes?: string | null
          phase?: Database["public"]["Enums"]["custody_phase"]
          qr_verified?: boolean
          flagged?: boolean
          flag_reasons?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "custody_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      custody_photos: {
        Row: {
          booking_id: string
          client_captured_at: string
          created_at: string
          id: string
          phase: Database["public"]["Enums"]["custody_phase"]
          sha256: string
          slot: string
          storage_path: string
          taken_by: string
        }
        Insert: {
          booking_id: string
          client_captured_at: string
          created_at?: string
          id?: string
          phase: Database["public"]["Enums"]["custody_phase"]
          sha256: string
          slot: string
          storage_path: string
          taken_by: string
        }
        Update: {
          booking_id?: string
          client_captured_at?: string
          created_at?: string
          id?: string
          phase?: Database["public"]["Enums"]["custody_phase"]
          sha256?: string
          slot?: string
          storage_path?: string
          taken_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "custody_photos_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_photos_taken_by_fkey"
            columns: ["taken_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      eligibility_rules: {
        Row: {
          allowed_user_types: Database["public"]["Enums"]["user_type"][]
          created_at: string
          max_duration_minutes: number | null
          min_lead_time_minutes: number
          requires_approval: boolean
          requires_supervision: boolean
          resource_id: string
          updated_at: string
        }
        Insert: {
          allowed_user_types?: Database["public"]["Enums"]["user_type"][]
          created_at?: string
          max_duration_minutes?: number | null
          min_lead_time_minutes?: number
          requires_approval?: boolean
          requires_supervision?: boolean
          resource_id: string
          updated_at?: string
        }
        Update: {
          allowed_user_types?: Database["public"]["Enums"]["user_type"][]
          created_at?: string
          max_duration_minutes?: number | null
          min_lead_time_minutes?: number
          requires_approval?: boolean
          requires_supervision?: boolean
          resource_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_rules_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: true
            referencedRelation: "resource_utilisation"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "eligibility_rules_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: true
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          ai_summary: string | null
          booking_id: string
          created_at: string
          description: string
          id: string
          institution_id: string
          reported_by: string
          resolved_at: string | null
          resolved_by: string | null
          resource_id: string
          severity: Database["public"]["Enums"]["incident_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          type: string
          updated_at: string
          resolution: "borrower_responsible" | "no_fault" | "shared_responsibility" | null
          resolution_notes: string | null
        }
        Insert: {
          ai_summary?: string | null
          booking_id: string
          created_at?: string
          description: string
          id?: string
          institution_id: string
          reported_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id: string
          severity: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          type: string
          updated_at?: string
          resolution?: "borrower_responsible" | "no_fault" | "shared_responsibility" | null
          resolution_notes?: string | null
        }
        Update: {
          ai_summary?: string | null
          booking_id?: string
          created_at?: string
          description?: string
          id?: string
          institution_id?: string
          reported_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id?: string
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          type?: string
          updated_at?: string
          resolution?: "borrower_responsible" | "no_fault" | "shared_responsibility" | null
          resolution_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_utilisation"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "incidents_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email_domain: string | null
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email_domain?: string | null
          id?: string
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email_domain?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          institution_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"] | null
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          institution_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          institution_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      qualifications: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualifications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualifications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      released_slots: {
        Row: {
          booking_id: string
          claimed_booking_id: string | null
          claimed_by: string | null
          created_at: string
          end_at: string
          id: string
          institution_id: string
          released_by: string
          resource_id: string
          start_at: string
          status: Database["public"]["Enums"]["slot_status"]
          updated_at: string
        }
        Insert: {
          booking_id: string
          claimed_booking_id?: string | null
          claimed_by?: string | null
          created_at?: string
          end_at: string
          id?: string
          institution_id: string
          released_by: string
          resource_id: string
          start_at: string
          status?: Database["public"]["Enums"]["slot_status"]
          updated_at?: string
        }
        Update: {
          booking_id?: string
          claimed_booking_id?: string | null
          claimed_by?: string | null
          created_at?: string
          end_at?: string
          id?: string
          institution_id?: string
          released_by?: string
          resource_id?: string
          start_at?: string
          status?: Database["public"]["Enums"]["slot_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "released_slots_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "released_slots_claimed_booking_id_fkey"
            columns: ["claimed_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "released_slots_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "released_slots_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "released_slots_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "released_slots_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "released_slots_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_utilisation"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "released_slots_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_accessories: {
        Row: {
          created_at: string
          id: string
          name: string
          required: boolean
          resource_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          required?: boolean
          resource_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          required?: boolean
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_accessories_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_utilisation"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "resource_accessories_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_availability_windows: {
        Row: {
          created_at: string
          end_time: string
          id: string
          resource_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          resource_id: string
          start_time: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          resource_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "resource_availability_windows_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_utilisation"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "resource_availability_windows_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_evidence: {
        Row: {
          created_at: string
          id: string
          note: string | null
          resource_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          resource_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          resource_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_evidence_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_utilisation"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "resource_evidence_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_required_qualifications: {
        Row: {
          qualification_id: string
          resource_id: string
        }
        Insert: {
          qualification_id: string
          resource_id: string
        }
        Update: {
          qualification_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_required_qualifications_qualification_id_fkey"
            columns: ["qualification_id"]
            isOneToOne: false
            referencedRelation: "qualifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_required_qualifications_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_utilisation"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "resource_required_qualifications_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          asset_tag: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_path: string | null
          institution_id: string
          is_available: boolean
          kind: Database["public"]["Enums"]["resource_kind"]
          location: string | null
          name: string
          required_photo_slots: string[]
          status: string
          updated_at: string
          qr_identifier: string
        }
        Insert: {
          asset_tag?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_path?: string | null
          institution_id: string
          is_available?: boolean
          kind: Database["public"]["Enums"]["resource_kind"]
          location?: string | null
          name: string
          required_photo_slots?: string[]
          status?: string
          updated_at?: string
          qr_identifier?: string
        }
        Update: {
          asset_tag?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_path?: string | null
          institution_id?: string
          is_available?: boolean
          kind?: Database["public"]["Enums"]["resource_kind"]
          location?: string | null
          name?: string
          required_photo_slots?: string[]
          status?: string
          updated_at?: string
          qr_identifier?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_categories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          institution_id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_categories_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_qualifications: {
        Row: {
          created_at: string
          evidence_path: string | null
          qualification_id: string
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          evidence_path?: string | null
          qualification_id: string
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          evidence_path?: string | null
          qualification_id?: string
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_qualifications_qualification_id_fkey"
            columns: ["qualification_id"]
            isOneToOne: false
            referencedRelation: "qualifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_qualifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_qualifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          created_at: string
          desired_end: string
          desired_start: string
          id: string
          resource_id: string
          status: Database["public"]["Enums"]["waitlist_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          desired_end: string
          desired_start: string
          id?: string
          resource_id: string
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          desired_end?: string
          desired_start?: string
          id?: string
          resource_id?: string
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_utilisation"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "waitlist_entries_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      institution_directory: {
        Row: {
          id: string | null
          name: string | null
          type: string | null
        }
        Insert: {
          id?: string | null
          name?: string | null
          type?: string | null
        }
        Update: {
          id?: string | null
          name?: string | null
          type?: string | null
        }
        Relationships: []
      }
      resource_utilisation: {
        Row: {
          available_minutes_30d: number | null
          booked_minutes_30d: number | null
          institution_id: string | null
          is_underutilised: boolean | null
          resource_id: string | null
          utilisation_pct: number | null
        }
        Insert: {
          available_minutes_30d?: never
          booked_minutes_30d?: never
          institution_id?: string | null
          is_underutilised?: never
          resource_id?: string | null
          utilisation_pct?: never
        }
        Update: {
          available_minutes_30d?: never
          booked_minutes_30d?: never
          institution_id?: string | null
          is_underutilised?: never
          resource_id?: string | null
          utilisation_pct?: never
        }
        Relationships: [
          {
            foreignKeyName: "resources_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      verify_asset_qr: {
        Args: { p_booking_id: string; p_qr: string; p_phase: string }
        Returns: boolean
      }
      start_checkout: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      start_return: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      resolve_dispute: {
        Args: { p_booking_id: string; p_notes: string; p_resolution: string }
        Returns: Database["public"]["Tables"]["bookings"]["Row"]
      }
      regenerate_resource_qr: {
        Args: { p_resource_id: string }
        Returns: string
      }
      get_my_context: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_public_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      set_member_institution: {
        Args: { p_institution_id: string }
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      search_institutions: {
        Args: { p_query: string }
        Returns: {
          id: string
          name: string
          type: string
        }[]
      }
      cancel_booking: {
        Args: { p_booking_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_at: string
          id: string
          institution_id: string
          purpose: string | null
          resource_id: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          supervisor_name: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_in_booking: {
        Args: {
          p_accessory_checks?: Json
          p_booking_id: string
          p_condition: Database["public"]["Enums"]["condition_rating"]
          p_notes: string
          p_photos: Json
          p_qr_identifier: string
        }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_at: string
          id: string
          institution_id: string
          purpose: string | null
          resource_id: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          supervisor_name: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_out_booking: {
        Args: {
          p_accessory_checks?: Json
          p_booking_id: string
          p_condition: Database["public"]["Enums"]["condition_rating"]
          p_notes: string
          p_photos: Json
          p_qr_identifier: string
        }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_at: string
          id: string
          institution_id: string
          purpose: string | null
          resource_id: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          supervisor_name: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_released_slot: {
        Args: { p_slot_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_at: string
          id: string
          institution_id: string
          purpose: string | null
          resource_id: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          supervisor_name: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_institution_id: { Args: never; Returns: string }
      ensure_category: {
        Args: {
          p_name: string
        }
        Returns: string
      }
      retire_resource: {
        Args: {
          p_reason?: string | null
          p_resource_id: string
        }
        Returns: Database["public"]["Tables"]["resources"]["Row"]
      }
      reactivate_resource: {
        Args: {
          p_resource_id: string
        }
        Returns: Database["public"]["Tables"]["resources"]["Row"]
      }
      decide_booking: {
        Args: { p_approve: boolean; p_booking_id: string; p_note?: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_at: string
          id: string
          institution_id: string
          purpose: string | null
          resource_id: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          supervisor_name: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_custody_timeline: { Args: { p_booking_id: string }; Returns: Json }
      inspect_return: {
        Args: {
          p_accessory_checks?: Json
          p_booking_id: string
          p_condition: Database["public"]["Enums"]["condition_rating"]
          p_notes?: string
        }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_at: string
          id: string
          institution_id: string
          purpose: string | null
          resource_id: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          supervisor_name: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      institution_stats: { Args: { p_institution_id: string }; Returns: Json }
      is_booking_participant: { Args: { b: string }; Returns: boolean }
      is_institution_admin: { Args: { inst: string }; Returns: boolean }
      is_verified_member: { Args: never; Returns: boolean }
      join_waitlist: {
        Args: { p_end: string; p_resource_id: string; p_start: string }
        Returns: {
          created_at: string
          desired_end: string
          desired_start: string
          id: string
          resource_id: string
          status: Database["public"]["Enums"]["waitlist_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "waitlist_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_waitlist: { Args: { p_entry_id: string }; Returns: undefined }
      my_waitlist: {
        Args: never
        Returns: {
          created_at: string
          desired_end: string
          desired_start: string
          id: string
          position: number
          resource_id: string
          status: Database["public"]["Enums"]["waitlist_status"]
        }[]
      }
      notify: {
        Args: {
          p_body: string
          p_link?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      release_booking: {
        Args: { p_booking_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_at: string
          id: string
          institution_id: string
          purpose: string | null
          resource_id: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          supervisor_name: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      report_incident: {
        Args: {
          p_booking_id: string
          p_description: string
          p_severity: Database["public"]["Enums"]["incident_severity"]
          p_type: string
        }
        Returns: {
          ai_summary: string | null
          booking_id: string
          created_at: string
          description: string
          id: string
          institution_id: string
          reported_by: string
          resolved_at: string | null
          resolved_by: string | null
          resource_id: string
          severity: Database["public"]["Enums"]["incident_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_booking: {
        Args: {
          p_end: string
          p_purpose: string
          p_resource_id: string
          p_start: string
          p_supervisor_name?: string
        }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_at: string
          id: string
          institution_id: string
          purpose: string | null
          resource_id: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          supervisor_name: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_incident: {
        Args: { p_incident_id: string }
        Returns: {
          ai_summary: string | null
          booking_id: string
          created_at: string
          description: string
          id: string
          institution_id: string
          reported_by: string
          resolved_at: string | null
          resolved_by: string | null
          resource_id: string
          severity: Database["public"]["Enums"]["incident_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_member: {
        Args: { p_approve: boolean; p_user_id: string }
        Returns: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          institution_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"] | null
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_qualification: {
        Args: {
          p_approve: boolean
          p_qualification_id: string
          p_user_id: string
        }
        Returns: {
          created_at: string
          evidence_path: string | null
          qualification_id: string
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_qualifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      booking_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "released"
        | "checked_out"
        | "returned"
        | "closed"
        | "disputed"
      condition_rating: "excellent" | "good" | "minor_wear" | "minor_damage" | "damaged" | "major_damage" | "missing_parts" | "non_functional"
      custody_phase: "checkout" | "checkin" | "inspection"
      incident_severity: "low" | "medium" | "high"
      incident_status: "open" | "resolved"
      resource_kind: "equipment" | "space" | "lab"
      slot_status: "open" | "claimed" | "expired"
      user_role: "institution_admin" | "member"
      user_type: "student" | "staff" | "external"
      verification_status: "pending" | "verified" | "rejected"
      waitlist_status:
        | "waiting"
        | "offered"
        | "claimed"
        | "expired"
        | "cancelled"
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
      booking_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "released",
        "checked_out",
        "returned",
        "closed",
        "disputed",
      ],
      condition_rating: ["excellent", "good", "minor_wear", "minor_damage", "damaged", "major_damage", "missing_parts", "non_functional"],
      custody_phase: ["checkout", "checkin", "inspection"],
      incident_severity: ["low", "medium", "high"],
      incident_status: ["open", "resolved"],
      resource_kind: ["equipment", "space", "lab"],
      slot_status: ["open", "claimed", "expired"],
      user_role: ["institution_admin", "member"],
      user_type: ["student", "staff", "external"],
      verification_status: ["pending", "verified", "rejected"],
      waitlist_status: [
        "waiting",
        "offered",
        "claimed",
        "expired",
        "cancelled",
      ],
    },
  },
} as const
