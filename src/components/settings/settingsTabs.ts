import type { LucideIcon } from 'lucide-react';
import { Tag, Calendar } from 'lucide-react';

export interface SettingsTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const settingsTabs: SettingsTab[] = [
  { id: 'contexts', label: 'Contexts', icon: Tag },
  { id: 'calendar-sync', label: 'Google Calendar Sync', icon: Calendar },
];

export const defaultSettingsTab = settingsTabs[0].id;
