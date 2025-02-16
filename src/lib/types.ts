export type TaskStatus = 'on_deck' | 'active' | 'completed';
export type Priority = 'low' | 'normal' | 'high' | null;
export type EntryType = 'task' | 'note' | 'project';
export type ProjectStatus = 'active' | 'completed' | 'on_hold';
export type StepStatus = 'pending' | 'in_progress' | 'completed';

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
  status: TaskStatus;
  description: string | null;
  priority: Priority;
  project_id: string | null;
  is_project_converted: boolean;
  converted_project_id: string | null;
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

export interface NoteWithDetails {
  id: string;
  content: string | null;
  item: Item;
}

export interface ProjectStep {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  order: number;  // Changed from order_index
  status: StepStatus;
  due_date: string | null;
  assigned_date: string | null;
  priority: Priority;
  is_converted: boolean;
  converted_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StepData {
  id: string;
  title: string;
  description: string;
  due_date?: Date | undefined;
  assigned_date?: Date | undefined;
  priority: Priority;
  order: number;
  status: StepStatus;  // Add this line
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