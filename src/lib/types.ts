export type TaskStatus = 'on_deck' | 'active' | 'completed';
export type Priority = 'low' | 'medium' | 'high' | null;
export type EntryType = 'task' | 'note';

export interface Item {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  item_type: string;
  is_archived: boolean;
  archived_at: string | null;
  archive_reason: string | null;
}

export interface TaskWithDetails {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  type: 'task';
  user_id: string;
  content: string | null;
  due_date: string | null;
  assigned_date: string | null;
  status: TaskStatus | null;
  priority: Priority;
  description: string | null;
  project_id: string | null;
  is_project_converted: boolean;
  converted_project_id: string | null;
  item: Item;
}