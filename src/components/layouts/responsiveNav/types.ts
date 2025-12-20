export type SectionType = 'dashboard' | 'tasks' | 'notes' | 'train-of-thought' | 'projects' | 'habits' | 'checklists' | 'quotes' | 'media-vault' | 'relationships' | 'feedback';

export interface NavProps {
  activeSection: SectionType;
  onSectionChange: (section: SectionType) => void;
}