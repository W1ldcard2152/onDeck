'use client'

import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import React, { useState, useEffect } from 'react';
import TruncatedCell from './TruncatedCell';
import { format } from 'date-fns';
import { Check, MoreHorizontal, Link, ChevronDown, ChevronUp, ChevronRight, AlertCircle } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { NewEntryForm } from '@/components/NewEntryForm';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Database } from '@/types/database.types';
import type { TaskWithDetails } from '@/lib/types';
import type { Priority, TaskStatus } from '@/types/database.types';
import ScrollableTableWrapper from './layouts/responsiveNav/ScrollableTableWrapper';
import { ProjectTaskManager } from '@/lib/projectTaskManager';
import { Alert, AlertDescription } from "@/components/ui/alert";

// Define types
type SortDirection = 'asc' | 'desc' | null;
type SortField = 'status' | 'title' | 'priority' | 'assigned_date' | 'description' | 'due_date' | 'project' | null;

interface SortState {
  field: SortField;
  direction: SortDirection;
  level: number;
}

interface TaskTableProps {
  tasks: TaskWithDetails[];
  onTaskUpdate: () => void;
}

interface TaskTableBaseProps {
  tasks: TaskWithDetails[];
  onTaskUpdate: () => void;
  sorts: SortState[];
  onSort: (field: SortField) => void;
  tableType: 'active' | 'completed';
}

interface ProjectInfo {
  title: string;
  status: string;
  stepTitle?: string;
}

// TaskTableBase Component
const TaskTableBase: React.FC<TaskTableBaseProps> = ({ 
  tasks, 
  onTaskUpdate,
  sorts,
  onSort,
  tableType
}) => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<TaskWithDetails | null>(null);
  const [projectInfoMap, setProjectInfoMap] = useState<Record<string, ProjectInfo>>({});
  const supabase = createClientComponentClient<Database>();
  const { user } = useSupabaseAuth();

  // Rest of the component implementation...
  
  return (
    <div>
      {/* Component rendering */}
    </div>
  );
};

// Main TaskTable component
const TaskTable: React.FC<TaskTableProps> = ({ tasks, onTaskUpdate }) => {
  const [showCompleted, setShowCompleted] = useState(false);
  const [sorts, setSorts] = useState<SortState[]>([]);

  // Rest of the component implementation...

  return (
    <div className="space-y-6">
      {/* Component rendering */}
    </div>
  );
};

export { TaskTable };
export default TaskTable;