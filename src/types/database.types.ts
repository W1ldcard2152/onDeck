// database.types.ts
export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          do_date: string | null;
          due_date: string | null;
          status: TaskStatus;
          description: string | null;
          is_project_converted: boolean;
          converted_project_id: string | null;
        };
      };
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
        };
      };
    };
  };
}