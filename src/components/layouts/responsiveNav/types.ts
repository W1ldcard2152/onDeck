export type SectionType = 'dashboard' | 'tasks' | 'notes' | 'projects' | 'knowledge' | 'habits' | 'journal' | 'feedback';

export interface NavProps {
  activeSection: SectionType;
  onSectionChange: (section: SectionType) => void;
}