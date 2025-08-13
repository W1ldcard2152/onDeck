export type SectionType = 'dashboard' | 'tasks' | 'notes' | 'projects' | 'knowledge' | 'habits' | 'journal';

export interface NavProps {
  activeSection: SectionType;
  onSectionChange: (section: SectionType) => void;
}