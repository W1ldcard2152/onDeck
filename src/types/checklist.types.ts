// Checklist types for OnDeck

export type ChecklistContext = 'Morning' | 'Work' | 'Family' | 'Evening' | 'Weekend';

export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  start_date: string;
  end_condition?: {
    type: 'end_date' | 'max_occurrences' | 'none';
    value?: string | number;
  };
  interval: number;
  unit: 'day' | 'week' | 'month' | 'year';
  count_per_unit?: number;
  days_of_week?: string[];
  days_of_month?: number[];
  ordinal_weeks?: Array<{ week: number; day: string }>;
  months_of_year?: number[];
  after_completion?: boolean;
  delay_after_completion?: string;
  skip_conditions?: string[];
  time_of_day?: string;
  custom_exclusions?: string[];
  custom_inclusions?: string[];
  offset_days?: number;
}

export interface ChecklistTemplate {
  id: string;
  user_id: string;
  name: string;
  version: number;
  recurrence_rule: RecurrenceRule | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  template_id: string;
  item_text: string;
  order_index: number;
  created_at: string;
}

export interface ChecklistContextAssignment {
  id: string;
  template_id: string;
  context: ChecklistContext;
}

export interface CheckedItem {
  item_id: string;
  item_text: string;
  checked: boolean;
  order_index: number;
}

export interface ChecklistCompletion {
  id: string;
  user_id: string;
  template_id: string;
  template_version: number;
  completed_at: string;
  checked_items: CheckedItem[];
  notes: string | null;
  created_at: string;
}

export interface ChecklistTemplateWithDetails extends ChecklistTemplate {
  items: ChecklistItem[];
  contexts: ChecklistContextAssignment[];
  streak?: number;
}
