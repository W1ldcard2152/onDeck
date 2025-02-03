// src/types/database.types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type EntryType = 'task' | 'project' | 'note' | 'habit' | 'journal';

export interface Database {
  public: {
    Tables: {
      entries: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          title: string
          type: EntryType
          tags: string[] | null
          user_id: string
          due_date: string | null
          status: string | null
          priority: string | null
          description: string | null
          progress: number | null
          content: string | null
          frequency: string | null
          streak: number | null
          target_days: number[] | null
          mood: string | null
          do_date: string | null
          is_project_converted: boolean | null
          converted_project_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          title: string
          type: EntryType
          tags?: string[] | null
          user_id: string
          due_date?: string | null
          status?: string | null
          priority?: string | null
          description?: string | null
          progress?: number | null
          content?: string | null
          frequency?: string | null
          streak?: number | null
          target_days?: number[] | null
          mood?: string | null
          do_date?: string | null
          is_project_converted?: boolean
          converted_project_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          title?: string
          type?: EntryType
          tags?: string[] | null
          user_id?: string
          due_date?: string | null
          status?: string | null
          priority?: string | null
          description?: string | null
          progress?: number | null
          content?: string | null
          frequency?: string | null
          streak?: number | null
          target_days?: number[] | null
          mood?: string | null
          do_date?: string | null
          is_project_converted?: boolean
          converted_project_id?: string | null
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

export type Entry = Database['public']['Tables']['entries']['Row'];

export interface BaseEntry extends Entry {
  type: EntryType;
}

export interface Task extends BaseEntry {
  type: 'task';
}

export interface Project extends BaseEntry {
  type: 'project';
}

export interface Note extends BaseEntry {
  type: 'note';
}

export interface Habit extends BaseEntry {
  type: 'habit';
}

export interface Journal extends BaseEntry {
  type: 'journal';
}