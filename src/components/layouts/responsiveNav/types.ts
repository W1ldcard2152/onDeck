export type SectionType = 'dashboard' | 'tasks' | 'notes' | 'projects' | 'habits' | 'checklists' | 'quotes' | 'media-vault' | 'feedback';

export interface NavProps {
  activeSection: SectionType;
  onSectionChange: (section: SectionType) => void;
}