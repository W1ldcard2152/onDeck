export type TaskStatus = 'on_deck' | 'active' | 'completed';
export type Priority = 'low' | 'normal' | 'high';

export interface Database {
  public: {
    Tables: {
      items: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
          item_type: string;
          is_archived: boolean;
          archived_at: string | null;
          archive_reason: string | null;
          status: TaskStatus;
          priority: Priority | null;
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
      tasks: {
        Row: {
          id: string;
          do_date: string | null;
          due_date: string | null;
          status: TaskStatus;
          description: string | null;
          is_project_converted: boolean;
          converted_project_id: string | null;
          assigned_date: string | null;
          priority: Priority;
        };
        Insert: {
          id: string;  // Must match items.id
          do_date?: string | null;
          due_date?: string | null;
          status?: TaskStatus;
          description?: string | null;
          is_project_converted?: boolean;
          converted_project_id?: string | null;
          assigned_date?: string | null;
          priority?: Priority;
        };
        Update: {
          id?: string;
          do_date?: string | null;
          due_date?: string | null;
          status?: TaskStatus;
          description?: string | null;
          is_project_converted?: boolean;
          converted_project_id?: string | null;
          assigned_date?: string | null;
          priority?: Priority;
        };
      };
    };
  };
}