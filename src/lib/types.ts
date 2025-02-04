// src/lib/types.ts
export interface Task {
  id: string;
  do_date: string | null;
  due_date: string | null;
  status: 'active' | 'completed' | 'archived';
  is_project_converted: boolean;
  converted_project_id: string | null;
}

export interface Item {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  item_type: 'task' | 'note' | 'project';
  is_archived: boolean;
  archived_at: string | null;
  archive_reason: string | null;
}

export interface TaskWithDetails extends Task {
  title: string;
  created_at: string;
  user_id: string;
}