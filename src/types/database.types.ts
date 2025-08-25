export type TaskStatus = 'on_deck' | 'active' | 'completed';
export type Priority = 'low' | 'normal' | 'high';
export type EntryType = 'article' | 'video' | 'document' | 'resource' | 'note' | 'link';

export interface NoteWithDetails {
  id: string;
  content: string | null;
  item: {
    id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
    item_type: string;
    is_archived: boolean;
    archived_at: string | null;
    archive_reason: string | null;
  };
}

export interface Database {
  public: {
    Tables: {
      items: {
        Row: {
          id: string;
          status: TaskStatus;
          description: string | null;
          priority: Priority | null;
          due_date: string | null;
          assigned_date: string | null;
          project_id: string | null;
          is_project_converted: boolean;
          converted_project_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          created_at?: string;
          updated_at?: string;
          item_type: string;
          is_archived?: boolean;
          archived_at?: string | null;
          archive_reason?: string | null;
          status?: TaskStatus;
          priority?: Priority | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
          item_type?: string;
          is_archived?: boolean;
          archived_at?: string | null;
          archive_reason?: string | null;
          status?: TaskStatus;
          priority?: Priority | null;
        };
      };
      notes: {
        Row: {
          id: string;
          content: string | null;
          url: string | null;
          file_path: string | null;
          entry_type: EntryType;
          knowledge_base_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;  // Must match items.id
          content?: string | null;
          url?: string | null;
          file_path?: string | null;
          entry_type?: EntryType;
          knowledge_base_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          content?: string | null;
          url?: string | null;
          file_path?: string | null;
          entry_type?: EntryType;
          knowledge_base_id?: string | null;
          created_at?: string;
        };
      };
      keystones: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      knowledge_bases: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          keystone_id: string | null;
          entry_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          keystone_id?: string | null;
          entry_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          keystone_id?: string | null;
          entry_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          due_date: string | null;
          reminder_time: string | null;
          status: TaskStatus;
          description: string | null;
          is_project_converted: boolean;
          converted_project_id: string | null;
          assigned_date: string | null;
          priority: Priority;
          project_id: string | null;
          habit_id: string | null;
        };
        Insert: {
          id: string;  // Must match items.id
          due_date?: string | null;
          reminder_time?: string | null;
          status?: TaskStatus;
          description?: string | null;
          is_project_converted?: boolean;
          converted_project_id?: string | null;
          assigned_date?: string | null;
          priority?: Priority;
          project_id?: string | null;
          habit_id?: string | null;
        };
        Update: {
          id?: string;
          due_date?: string | null;
          reminder_time?: string | null;
          status?: TaskStatus;
          description?: string | null;
          is_project_converted?: boolean;
          converted_project_id?: string | null;
          assigned_date?: string | null;
          priority?: Priority;
          project_id?: string | null;
          habit_id?: string | null;
        };
      };
    };
  };
}