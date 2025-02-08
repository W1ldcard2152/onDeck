// src/layouts/responsiveNav/types.ts

export type SectionType = 'dashboard' | 'tasks' | 'notes' | 'projects' | 'habits' | 'journal';

export interface NavProps {
  activeSection: SectionType;
  onSectionChange: (section: SectionType) => void;
}