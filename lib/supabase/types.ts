export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          tiktok_username: string | null
          geelark_profile_id: string | null
          status: 'new' | 'warming_up' | 'active' | 'paused' | 'banned'
          warmup_done: boolean
          warmup_progress: number
          proxy_id: string | null
          created_at: string
          updated_at: string
          banned_at: string | null
          error_count: number
          last_error: string | null
          last_used: string | null
          meta: Json
        }
        Insert: {
          id?: string
          tiktok_username?: string | null
          geelark_profile_id?: string | null
          status?: 'new' | 'warming_up' | 'active' | 'paused' | 'banned'
          warmup_done?: boolean
          warmup_progress?: number
          proxy_id?: string | null
          created_at?: string
          updated_at?: string
          banned_at?: string | null
          error_count?: number
          last_error?: string | null
          last_used?: string | null
          meta?: Json
        }
        Update: {
          id?: string
          tiktok_username?: string | null
          geelark_profile_id?: string | null
          status?: 'new' | 'warming_up' | 'active' | 'paused' | 'banned'
          warmup_done?: boolean
          warmup_progress?: number
          proxy_id?: string | null
          created_at?: string
          updated_at?: string
          banned_at?: string | null
          error_count?: number
          last_error?: string | null
          last_used?: string | null
          meta?: Json
        }
      }
      phones: {
        Row: {
          id: string
          profile_id: string
          account_id: string | null
          status: 'online' | 'offline' | 'error'
          battery: number | null
          device_model: string | null
          android_version: string | null
          last_heartbeat: string | null
          created_at: string
          updated_at: string
          meta: Json
        }
        Insert: {
          id?: string
          profile_id: string
          account_id?: string | null
          status?: 'online' | 'offline' | 'error'
          battery?: number | null
          device_model?: string | null
          android_version?: string | null
          last_heartbeat?: string | null
          created_at?: string
          updated_at?: string
          meta?: Json
        }
        Update: {
          id?: string
          profile_id?: string
          account_id?: string | null
          status?: 'online' | 'offline' | 'error'
          battery?: number | null
          device_model?: string | null
          android_version?: string | null
          last_heartbeat?: string | null
          created_at?: string
          updated_at?: string
          meta?: Json
        }
      }
      proxies: {
        Row: {
          id: string
          geelark_id: string
          scheme: string
          server: string
          port: number
          username: string | null
          password: string | null
          group_name: string | null
          tags: string[] | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          geelark_id: string
          scheme: string
          server: string
          port: number
          username?: string | null
          password?: string | null
          group_name?: string | null
          tags?: string[] | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          geelark_id?: string
          scheme?: string
          server?: string
          port?: number
          username?: string | null
          password?: string | null
          group_name?: string | null
          tags?: string[] | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      sms_rentals: {
        Row: {
          id: string
          rental_id: string | null
          phone_number: string
          otp_code: string | null
          status: 'waiting' | 'received' | 'cancelled' | 'expired'
          expires_at: string
          account_id: string | null
          created_at: string
          updated_at: string
          meta: Json
        }
        Insert: {
          id?: string
          rental_id?: string | null
          phone_number: string
          otp_code?: string | null
          status?: 'waiting' | 'received' | 'cancelled' | 'expired'
          expires_at: string
          account_id?: string | null
          created_at?: string
          updated_at?: string
          meta?: Json
        }
        Update: {
          id?: string
          rental_id?: string | null
          phone_number?: string
          otp_code?: string | null
          status?: 'waiting' | 'received' | 'cancelled' | 'expired'
          expires_at?: string
          account_id?: string | null
          created_at?: string
          updated_at?: string
          meta?: Json
        }
      }
      posts: {
        Row: {
          id: string
          account_id: string
          asset_path: string
          caption: string | null
          hashtags: string[] | null
          geelark_task_id: string | null
          status: 'queued' | 'processing' | 'posted' | 'failed' | 'cancelled'
          tiktok_post_id: string | null
          posted_at: string | null
          error: string | null
          retry_count: number
          created_at: string
          updated_at: string
          meta: Json
        }
        Insert: {
          id?: string
          account_id: string
          asset_path: string
          caption?: string | null
          hashtags?: string[] | null
          geelark_task_id?: string | null
          status?: 'queued' | 'processing' | 'posted' | 'failed' | 'cancelled'
          tiktok_post_id?: string | null
          posted_at?: string | null
          error?: string | null
          retry_count?: number
          created_at?: string
          updated_at?: string
          meta?: Json
        }
        Update: {
          id?: string
          account_id?: string
          asset_path?: string
          caption?: string | null
          hashtags?: string[] | null
          geelark_task_id?: string | null
          status?: 'queued' | 'processing' | 'posted' | 'failed' | 'cancelled'
          tiktok_post_id?: string | null
          posted_at?: string | null
          error?: string | null
          retry_count?: number
          created_at?: string
          updated_at?: string
          meta?: Json
        }
      }
      tasks: {
        Row: {
          id: string
          type: 'warmup' | 'post' | 'check_status' | 'other'
          geelark_task_id: string | null
          account_id: string | null
          status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          started_at: string | null
          ended_at: string | null
          message: string | null
          created_at: string
          updated_at: string
          meta: Json
        }
        Insert: {
          id?: string
          type: 'warmup' | 'post' | 'check_status' | 'other'
          geelark_task_id?: string | null
          account_id?: string | null
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          started_at?: string | null
          ended_at?: string | null
          message?: string | null
          created_at?: string
          updated_at?: string
          meta?: Json
        }
        Update: {
          id?: string
          type?: 'warmup' | 'post' | 'check_status' | 'other'
          geelark_task_id?: string | null
          account_id?: string | null
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          started_at?: string | null
          ended_at?: string | null
          message?: string | null
          created_at?: string
          updated_at?: string
          meta?: Json
        }
      }
      logs: {
        Row: {
          id: string
          timestamp: string
          level: 'debug' | 'info' | 'warning' | 'error' | 'critical'
          component: string
          account_id: string | null
          message: string
          meta: Json
        }
        Insert: {
          id?: string
          timestamp?: string
          level: 'debug' | 'info' | 'warning' | 'error' | 'critical'
          component: string
          account_id?: string | null
          message: string
          meta?: Json
        }
        Update: {
          id?: string
          timestamp?: string
          level?: 'debug' | 'info' | 'warning' | 'error' | 'critical'
          component?: string
          account_id?: string | null
          message?: string
          meta?: Json
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}