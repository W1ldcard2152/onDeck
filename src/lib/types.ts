export type TaskStatus = 'on_deck' | 'active' | 'completed';
export type Priority = 'low' | 'normal' | 'high' | null;
export type EntryType = 'task' | 'note' | 'project' | 'quote';
export type KnowledgeEntryType = 'article' | 'video' | 'document' | 'resource' | 'note' | 'link';
export type NoteType = 'note' | 'thought';
export type ProjectStatus = 'active' | 'completed' | 'on_hold';
export type StepStatus = 'pending' | 'in_progress' | 'completed';
export type DailyContext = 'all_day' | 'morning' | 'work' | 'family' | 'evening';

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

export interface Task {
  id: string;
  assigned_date: string | null;
  due_date: string | null;
  reminder_time: string | null;
  status: TaskStatus;
  description: string | null;
  priority: Priority;
  project_id: string | null;
  habit_id: string | null;
  is_project_converted: boolean;
  converted_project_id: string | null;
  daily_context?: string | null; // JSON array of DailyContext values, or null for all-day
  sort_order: number; // Manual sort order within context
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
  reminder_time: string | null;
  status: TaskStatus | null;
  priority: Priority;
  description: string | null;
  project_id: string | null;
  habit_id: string | null;
  is_project_converted: boolean;
  converted_project_id: string | null;
  daily_context?: string | null; // JSON array of DailyContext values, or null for all-day
  sort_order: number; // Manual sort order within context
  item: Item;
}

export interface NoteWithDetails {
  id: string;
  content: string | null;
  url: string | null;
  file_path: string | null;
  entry_type: KnowledgeEntryType;
  note_type: NoteType;
  knowledge_base_id: string | null;
  item: Item;
  knowledge_base?: KnowledgeBase;
}

export interface ProjectStep {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  order_number: number;  // Changed from order to match DB
  status: StepStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  // Additional fields we want to support
  priority: Priority;
  due_date: string | null;
  assigned_date: string | null;
  is_converted: boolean;
  converted_task_id: string | null;
  daily_context?: string | null; // JSON array of DailyContext values, or null for all-day
}

export interface StepData {
  id: string;
  title: string;
  description: string;
  due_date?: Date | undefined;
  assigned_date?: Date | undefined;
  priority: Priority;
  order_number: number;  // Changed from 'order'
  status: StepStatus;
  is_converted: boolean;
  converted_task_id: string | null;
  project_id?: string;
}

export interface ProjectWithDetails {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  progress: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  current_step: number;
  estimated_completion_date: string | null;
  priority: Priority;
  parent_task_id: string | null;
  user_id: string;
  tasks: Task[];
  item: Item;
  steps: ProjectStep[];
}

export interface Keystone {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBase {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  keystone_id: string | null;
  entry_count: number;
  created_at: string;
  updated_at: string;
  keystone?: Keystone;
}

export interface KnowledgeBaseWithDetails extends KnowledgeBase {
  entries: NoteWithDetails[];
}

export interface Quote {
  id: string;
  content: string;
  author: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteWithDetails {
  id: string;
  content: string;
  author: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  item: Item;
}