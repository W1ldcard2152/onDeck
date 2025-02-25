import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, GripVertical, Trash2, ArrowUp, ArrowDown, AlertCircle, CheckCircle2, Clock, } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { DayPicker } from "react-day-picker";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ProjectTaskManager, ProjectStep } from '@/lib/projectTaskManager';
import type { ProjectWithDetails, Priority, ProjectStatus, StepStatus, } from '@/lib/types';
import type { User } from '@supabase/auth-helpers-nextjs';

// Types and Interfaces
interface StepData {
  id: string;
  title: string;
  description: string;
  order_number: number;
  status: StepStatus;
  priority: Priority;
  due_date?: Date;
  assigned_date?: Date;
  is_converted: boolean;
  converted_task_id: string | null;
  needsImmediateTask?: boolean;
}

interface ProjectEntryFormProps {
  onProjectCreated?: (project: { id: string }) => void;
  initialData?: ProjectWithDetails | null;
  isEditing?: boolean;
  onClose?: () => void;
}

export const ProjectEntryForm: React.FC<ProjectEntryFormProps> = ({
  onProjectCreated,
  initialData = null,
  isEditing = false,
  onClose
}) => {
  const { user } = useSupabaseAuth();
  const supabase = createClientComponentClient();

  // State
  const [open, setOpen] = useState(isEditing);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [steps, setSteps] = useState<StepData[]>([
    {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      order_number: 0,
      status: 'pending',
      priority: 'normal',
      is_converted: false,
      converted_task_id: null
    },
    {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      order_number: 1,
      status: 'pending',
      priority: 'normal',
      is_converted: false,
      converted_task_id: null
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowWarning, setWorkflowWarning] = useState<string | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<Record<string, boolean>>({});

  // Function to clean up non-completed tasks for a project - DEFINE THIS FIRST
  const cleanupNonCompletedTasks = async (projectId: string) => {
    try {
      // First, get all project steps with tasks
      const { data: stepsWithTasks, error: stepsError } = await supabase
        .from('project_steps')
        .select('id, converted_task_id, is_converted')
        .eq('project_id', projectId)
        .eq('is_converted', true)
        .not('converted_task_id', 'is', null);
        
      if (stepsError) throw stepsError;
      
      // Get all non-completed tasks for the project
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('project_id', projectId)
        .neq('status', 'completed');
      
      if (tasksError) throw tasksError;
      if (!tasks || tasks.length === 0) return;
      
      console.log(`Found ${tasks.length} non-completed tasks to delete for project ${projectId}`);
      
      // For each task and step with a task, reset and clean up
      const stepIds = stepsWithTasks?.map(step => step.id) || [];
      
      // 1. Reset ALL steps for this project (not just the ones with completed tasks)
      // This ensures we don't have any lingering task references
      const { error: resetStepsError } = await supabase
        .from('project_steps')
        .update({
          is_converted: false,
          converted_task_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('project_id', projectId)
        .in('is_converted', [true])
      
      if (resetStepsError) {
        console.error(`Error resetting steps for project ${projectId}:`, resetStepsError);
      }
      
      // 2. Delete all non-completed tasks
      for (const task of tasks) {
        // Delete the task from the tasks table
        const { error: taskError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', task.id);
        
        if (taskError) {
          console.error(`Error deleting task ${task.id}:`, taskError);
          continue; // Skip item deletion if task deletion fails
        }
        
        // Delete the item from the items table
        const { error: itemError } = await supabase
          .from('items')
          .delete()
          .eq('id', task.id);
        
        if (itemError) {
          console.error(`Error deleting item for task ${task.id}:`, itemError);
        }
      }
      
      console.log(`Successfully cleaned up tasks for project ${projectId}`);
    } catch (error) {
      console.error('Error cleaning up project tasks:', error);
      throw error;
    }
  };

  // Effect to populate form when editing
  useEffect(() => {
    if (initialData && isEditing) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setPriority(initialData.priority || 'normal');
      setStatus(initialData.status || 'active');

      if (initialData.steps && Array.isArray(initialData.steps)) {
        const initialSteps = initialData.steps.map((step: ProjectStep) => ({
          id: step.id,
          title: step.title || '',
          description: step.description || '',
          order_number: step.order_number,
          status: step.status,
          priority: step.priority || 'normal',
          due_date: step.due_date ? new Date(step.due_date) : undefined,
          assigned_date: step.assigned_date ? new Date(step.assigned_date) : undefined,
          is_converted: step.is_converted || false,
          converted_task_id: step.converted_task_id
        }));

        // Sort steps by order number to ensure correct sequence
        initialSteps.sort((a, b) => a.order_number - b.order_number);
        setSteps(initialSteps);
      }
    }
  }, [initialData, isEditing]);

  // Helper Functions
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('normal');
    setStatus('active');
    setSteps([
      {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        order_number: 0,
        status: 'pending',
        priority: 'normal',
        is_converted: false,
        converted_task_id: null
      },
      {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        order_number: 1,
        status: 'pending',
        priority: 'normal',
        is_converted: false,
        converted_task_id: null
      }
    ]);
    setError(null);
    setWorkflowWarning(null);
    setShowAdvancedOptions({});
  };

  const checkWorkflowIssues = (): boolean => {
    // Check for any steps out of sequence (completed steps before pending ones)
    let foundPending = false;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].status !== 'completed') {
        foundPending = true;
      } else if (foundPending) {
        // Found a completed step after a pending one
        setWorkflowWarning(
          "Warning: Your steps are out of sequence (completed steps after pending steps). " +
          "This might affect the task workflow."
        );
        return true;
      }
    }

    // Check if a converted step is being changed
    const convertedStepsBeingModified = steps.some(step => 
      step.is_converted && 
      step.converted_task_id && 
      (step.status === 'pending')
    );

    if (convertedStepsBeingModified) {
      setWorkflowWarning(
        "Warning: You're changing steps that already have associated tasks. " +
        "These changes will affect the existing tasks."
      );
      return true;
    }

    setWorkflowWarning(null);
    return false;
  };

  const handleAddStep = (afterIndex?: number) => {
    const newSteps = [...steps];
    const insertIndex = typeof afterIndex === 'number' ? afterIndex + 1 : steps.length;
    
    // Create the new step with a temporary negative order_number to avoid conflicts
    const newStep: StepData = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      order_number: -1, // Temporary negative value
      status: 'pending',
      priority: 'normal',
      is_converted: false,
      converted_task_id: null,
      needsImmediateTask: false
    };
    
    // Insert the new step at the correct position
    newSteps.splice(insertIndex, 0, newStep);
  
    // Update order numbers for ALL steps to ensure consistency
    newSteps.forEach((step, idx) => {
      step.order_number = idx;
    });
  
    setSteps(newSteps);
    checkWorkflowIssues();
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) {
      setError("Project must have at least one step");
      return;
    }

    const stepToRemove = steps[index];
    
    // Check if this step has an associated task
    if (stepToRemove.is_converted && stepToRemove.converted_task_id) {
      if (!window.confirm(
        "This step has an associated task that will also be deleted. Continue?"
      )) {
        return;
      }
    }

    const newSteps = steps.filter((_, i) => i !== index)
      .map((step, i) => ({
        ...step,
        order_number: i
      }));

    setSteps(newSteps);
    checkWorkflowIssues();
  };

  const handleStepChange = (index: number, field: keyof StepData, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = {
      ...newSteps[index],
      [field]: value
    };

    // Special handling for status changes
    if (field === 'status') {
      if (value === 'completed' && newSteps[index].status !== 'completed') {
        // Making a step completed
        // Check if any earlier steps are not completed
        for (let i = 0; i < index; i++) {
          if (newSteps[i].status !== 'completed') {
            if (!window.confirm(
              "You're marking this step as completed while earlier steps are still pending. " +
              "This might cause workflow issues. Continue?"
            )) {
              return; // Cancel the status change
            }
            break;
          }
        }
      } else if (value !== 'completed' && newSteps[index].status === 'completed') {
        // Unmarking a completed step
        // Check if any later steps are completed
        for (let i = index + 1; i < newSteps.length; i++) {
          if (newSteps[i].status === 'completed') {
            if (!window.confirm(
              "You're unmarking this step while later steps are already completed. " +
              "This might cause workflow issues. Continue?"
            )) {
              return; // Cancel the status change
            }
            break;
          }
        }
      }
    }

    setSteps(newSteps);
    checkWorkflowIssues();
  };

  const toggleAdvancedOptions = (stepId: string) => {
    setShowAdvancedOptions(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  const handleMoveStep = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= steps.length) return;
    
    const movedStep = steps[fromIndex];
    const targetStep = steps[toIndex];
    
    // Check for workflow issues when reordering steps with different completion status
    if (movedStep.status !== targetStep.status) {
      if (!window.confirm(
        "Changing the order of completed and pending steps may cause workflow issues. Continue?"
      )) {
        return;
      }
    }
    
    const newSteps = [...steps];
    const [removed] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, removed);
    
    // Update order_number for all steps to maintain proper sequence
    newSteps.forEach((step, index) => {
      step.order_number = index;
    });
    
    setSteps(newSteps);
    checkWorkflowIssues();
  };

  // Form submission logic
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!user) {
      setError('You must be logged in to create projects');
      setIsSubmitting(false);
      return;
    }

    if (steps.some(step => !step.title.trim())) {
      setError('All steps must have a title');
      setIsSubmitting(false);
      return;
    }

    try {
      const now = new Date().toISOString();

      if (isEditing && initialData) {
        await handleEditProject(now);
      } else {
        await handleCreateProject(now);
      }

      setOpen(false);
      resetForm();
      if (onClose) onClose();
    } catch (err) {
      console.error('Error saving project:', err);
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProject = async (now: string) => {
    if (!user?.id) return;
  
    try {
      // Create the project item
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .insert([{
          title: title.trim(),
          user_id: user.id,
          item_type: 'project',
          created_at: now,
          updated_at: now,
          is_archived: false
        }])
        .select()
        .single();
  
      if (itemError) throw itemError;
      if (!itemData) throw new Error('Failed to create item');
  
      // Create the project
      const { error: projectError } = await supabase
        .from('projects')
        .insert([{
          id: itemData.id,
          title: title.trim(),
          description: description.trim() || null,
          status: status,
          priority: priority,
          progress: 0,
          current_step: 0,
          user_id: user.id,
          created_at: now,
          updated_at: now
        }]);
  
      if (projectError) throw projectError;
  
      // Create steps
      const stepsToInsert = steps.map((step, index) => ({
        project_id: itemData.id,
        title: step.title.trim(),
        description: step.description.trim() || null,
        order_number: index, // Use index to ensure correct sequence
        status: step.status,
        priority: step.priority,
        due_date: step.due_date?.toISOString() || null,
        assigned_date: step.assigned_date?.toISOString() || null,
        is_converted: false,
        converted_task_id: null,
        created_at: now,
        updated_at: now
      }));

      const { data: createdSteps, error: stepsError } = await supabase
        .from('project_steps')
        .insert(stepsToInsert)
        .select();

      if (stepsError) throw stepsError;

      // Initialize ProjectTaskManager
      const projectTaskManager = new ProjectTaskManager({ 
        supabase, 
        userId: user?.id || null // Convert undefined to null
      });

      // Create task for the first step
      const firstStep = createdSteps[0];
      await projectTaskManager.createTaskForStep(firstStep, itemData.id);

      // Notify parent component
      if (onProjectCreated) {
        onProjectCreated({ id: itemData.id });
      }
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  };

  const handleEditProject = async (now: string) => {
    // Validation
    if (!initialData?.id) {
      throw new Error('Project ID is required for editing');
    }
  
    // Update the item
    const { error: itemError } = await supabase
      .from('items')
      .update({
        title: title.trim(),
        updated_at: now
      })
      .eq('id', initialData.id);
  
    if (itemError) throw itemError;
    
    // Check if status is changing to on_hold
    const isPuttingOnHold = status === 'on_hold' && initialData.status !== 'on_hold';
    let finalStatus = status;
    
    if (isPuttingOnHold) {
      const confirmOnHold = window.confirm(
        "Putting this project on hold will delete any active or pending tasks associated with it. " +
        "Completed tasks will remain untouched. Continue?"
      );
      
      if (confirmOnHold) {
        // Delete active and on_deck tasks for this project
        await cleanupNonCompletedTasks(initialData.id);
      } else {
        // Don't put on hold if user cancels
        finalStatus = initialData.status;
      }
    }
  
    // Check if status is changing to completed
    const isCompletingProject = finalStatus === 'completed' && initialData.status !== 'completed';
    
    if (isCompletingProject) {
      // Check if all steps are completed
      const incompleteSteps = steps.filter(step => step.status !== 'completed');
      
      if (incompleteSteps.length > 0) {
        const confirmComplete = window.confirm(
          `There are ${incompleteSteps.length} incomplete steps. Would you like to mark them all as completed?`
        );
        
        if (confirmComplete) {
          // Update steps to completed in our local state
          const updatedSteps = steps.map(step => ({
            ...step,
            status: 'completed' as StepStatus
          }));
          setSteps(updatedSteps);
        } else {
          // Don't mark project as completed if user doesn't want to complete all steps
          finalStatus = 'active';
        }
      }
    }
    
    // Update the project
    const { error: projectError } = await supabase
      .from('projects')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        status: finalStatus,
        priority: priority,
        updated_at: now,
        completed_at: finalStatus === 'completed' ? now : null,
        // Calculate progress based on completed steps
        progress: steps.length > 0 
          ? Math.round((steps.filter(s => s.status === 'completed').length / steps.length) * 100) 
          : 0
      })
      .eq('id', initialData.id);
  
    if (projectError) throw projectError;
  
    // Handle step updates
    await handleStepUpdates(initialData.id, now);
    
    // Final reordering step to ensure correct order
    await handleFinalProjectStepOrdering(initialData.id);
  
    // Make sure project and tasks are in sync - but only if not on hold
    if (finalStatus !== 'on_hold') {
      const projectTaskManager = new ProjectTaskManager({ 
        supabase, 
        userId: user?.id || null 
      });
      await projectTaskManager.syncProjectSteps(initialData.id);
    }
  
    // Notify parent component
    if (onProjectCreated) {
      onProjectCreated({ id: initialData.id });
    }
  };

  const handleStepUpdates = async (projectId: string, now: string) => {
    try {
      // Get existing steps
      const { data: existingSteps, error: stepsError } = await supabase
        .from('project_steps')
        .select('*')
        .eq('project_id', projectId)
        .order('order_number', { ascending: true });
  
      if (stepsError) throw stepsError;
  
      const existingStepIds = new Set(existingSteps?.map(step => step.id) || []);
      const newStepIds = new Set(steps.map(step => step.id));
  
      // STEP 1: Delete steps that were removed
      const stepsToDelete = existingSteps?.filter(step => !newStepIds.has(step.id)) || [];
      
      if (stepsToDelete.length > 0) {
        // Check if any steps have associated tasks
        const stepsWithTasks = stepsToDelete.filter(step => 
          step.is_converted && step.converted_task_id
        );
        
        if (stepsWithTasks.length > 0 && !window.confirm(
          `${stepsWithTasks.length} step(s) with associated tasks will be deleted. Continue?`
        )) {
          throw new Error('Operation cancelled');
        }
        
        // Delete associated tasks first
        for (const step of stepsWithTasks) {
          if (step.converted_task_id) {
            await supabase
              .from('tasks')
              .delete()
              .eq('id', step.converted_task_id);
              
            await supabase
              .from('items')
              .delete()
              .eq('id', step.converted_task_id);
          }
        }
        
        // Now delete the steps
        await supabase
          .from('project_steps')
          .delete()
          .in('id', stepsToDelete.map(step => step.id));
      }
      
      // STEP 2: Update existing steps
      const stepsToUpdate = steps.filter(step => existingStepIds.has(step.id));
      
      for (const step of stepsToUpdate) {
        // Only update properties except order_number for now
        await supabase
          .from('project_steps')
          .update({
            title: step.title.trim(),
            description: step.description.trim() || null,
            status: step.status,
            priority: step.priority,
            due_date: step.due_date?.toISOString() || null,
            assigned_date: step.assigned_date?.toISOString() || null,
            updated_at: now
          })
          .eq('id', step.id);
      }
      
      // STEP 3: Create new steps with temporary high order numbers
      const stepsToCreate = steps.filter(step => !existingStepIds.has(step.id));
      
      if (stepsToCreate.length > 0) {
        // Use very high order numbers temporarily to avoid conflicts
        const startingOrder = 10000;
        
        const stepsToInsert = stepsToCreate.map((step, index) => ({
          project_id: projectId,
          title: step.title.trim(),
          description: step.description.trim() || null,
          order_number: startingOrder + index, // Use high temporary order
          status: step.status,
          priority: step.priority,
          due_date: step.due_date?.toISOString() || null,
          assigned_date: step.assigned_date?.toISOString() || null,
          is_converted: false,
          converted_task_id: null,
          created_at: now,
          updated_at: now
        }));
        
        await supabase
          .from('project_steps')
          .insert(stepsToInsert);
      }
      
      // STEP 4: Now reorder ALL steps at once to match the UI order
      const { data: allSteps } = await supabase
        .from('project_steps')
        .select('*')
        .eq('project_id', projectId);
        
      if (!allSteps || allSteps.length === 0) return;
      
      // Create maps for matching DB steps with UI steps
      const stepById = new Map();
      const stepByTitle = new Map();
      
      // Fill maps with DB steps
      allSteps.forEach(dbStep => {
        stepById.set(dbStep.id, dbStep);
        stepByTitle.set(dbStep.title.trim(), dbStep);
      });
      
      // Create an array to hold steps in their final order
      const orderedSteps = [];
      
      // Match steps from UI to DB
      for (const uiStep of steps) {
        let dbStep = stepById.get(uiStep.id);
        
        // If not found by ID (new steps with temporary IDs), try by title
        if (!dbStep && uiStep.id.includes('-')) {
          dbStep = stepByTitle.get(uiStep.title.trim());
        }
        
        if (dbStep) {
          orderedSteps.push(dbStep);
        }
      }
      
      // Add any DB steps not found in UI at the end
      for (const dbStep of allSteps) {
        if (!orderedSteps.includes(dbStep)) {
          orderedSteps.push(dbStep);
        }
      }
      
      // CRITICAL: Update steps one by one with delay to prevent race conditions
      for (let i = 0; i < orderedSteps.length; i++) {
        // Use a temporary value outside normal range to avoid conflicts
        const tempOrder = -1000 - i;
        
        // First update to temporary negative value
        await supabase
          .from('project_steps')
          .update({ order_number: tempOrder })
          .eq('id', orderedSteps[i].id);
      }
      
      // Now update to final values
      for (let i = 0; i < orderedSteps.length; i++) {
        await supabase
          .from('project_steps')
          .update({ order_number: i })
          .eq('id', orderedSteps[i].id);
      }
    } catch (error) {
      console.error('Error updating steps:', error);
      throw error;
    }
  };

  interface DbStep {
    id: string;
    project_id: string;
    title: string;
    description: string | null;
    order_number: number;
    status: string;
    priority: string | null;
    due_date: string | null;
    assigned_date: string | null;
    is_converted: boolean;
    converted_task_id: string | null;
    created_at: string;
    updated_at: string;
    completed_at?: string | null;
    [key: string]: any; // For any other properties we might have missed
  }

  const handleFinalProjectStepOrdering = async (projectId: string) => {
    // First get all steps from the database
    const { data: allSteps } = await supabase
      .from('project_steps')
      .select('*')
      .eq('project_id', projectId);
      
    if (!allSteps || allSteps.length === 0) return;
    
    // Create a step lookup by ID and Title
    const stepsById = new Map<string, DbStep>();
    const stepsByTitle = new Map<string, DbStep>();
    
    allSteps.forEach(step => {
      stepsById.set(step.id, step);
      if (!stepsByTitle.has(step.title.trim())) { // Only add if not already there
        stepsByTitle.set(step.title.trim(), step);
      }
    });
    
    // Create ordered array based on UI
    const orderedSteps: DbStep[] = [];
    
    // First add steps from UI in their order
    for (const uiStep of steps) {
      let dbStep = stepsById.get(uiStep.id);
      
      // For new steps with temporary IDs
      if (!dbStep && uiStep.id.includes('-')) {
        dbStep = stepsByTitle.get(uiStep.title.trim());
      }
      
      if (dbStep && !orderedSteps.includes(dbStep)) {
        orderedSteps.push(dbStep);
      }
    }
    
    // Add any remaining DB steps not in UI
    for (const dbStep of allSteps) {
      if (!orderedSteps.some(step => step.id === dbStep.id)) {
        orderedSteps.push(dbStep);
      }
    }
    
    // Two-phase update to avoid unique constraint conflicts
    try {
      // Phase 1: Set all to negative values to avoid conflicts
      for (let i = 0; i < orderedSteps.length; i++) {
        await supabase
          .from('project_steps')
          .update({ order_number: -1000 - i })
          .eq('id', orderedSteps[i].id);
        
        // Add small delay to ensure operations complete in order
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Phase 2: Set to final values
      for (let i = 0; i < orderedSteps.length; i++) {
        await supabase
          .from('project_steps')
          .update({ order_number: i })
          .eq('id', orderedSteps[i].id);
        
        // Add small delay to ensure operations complete in order
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error('Error reordering steps:', error);
      throw error;
    }
  };

// Render date picker component for step due date and assigned date
const renderDatePicker = (
  selectedDate: Date | undefined, 
  onDateChange: (date: Date | undefined) => void, 
  label: string
) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "PPP") : `Pick ${label.toLowerCase()}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div className="border rounded-md bg-white p-3">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={onDateChange}
            showOutsideDays={true}
            defaultMonth={selectedDate}
          />
        </div>
      </PopoverContent>
    </Popover>
  </div>
);

// Render step status badge with appropriate color
const renderStepStatusBadge = (status: StepStatus) => {
  let color = '';
  let icon = null;
  
  switch (status) {
    case 'completed':
      color = 'bg-green-100 text-green-800';
      icon = <CheckCircle2 className="h-3 w-3 mr-1" />;
      break;
    case 'in_progress':
      color = 'bg-blue-100 text-blue-800';
      icon = <Clock className="h-3 w-3 mr-1" />;
      break;
    default:
      color = 'bg-gray-100 text-gray-800';
      break;
  }
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${color}`}>
      {icon}
      {status === 'pending' ? 'Pending' : 
       status === 'in_progress' ? 'In Progress' : 'Completed'}
    </span>
  );
};

// Render step item with all its controls
const renderStep = (step: StepData, index: number) => {
  const showAdvanced = showAdvancedOptions[step.id] || false;
  
  return (
    <div
      key={step.id}
      className="p-3 bg-white border-b last:border-b-0"
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 mt-1">
          <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
          <span className="text-sm text-gray-500">#{index + 1}</span>
        </div>
        
        <div className="flex-1 space-y-2">
          <div className="flex justify-between">
            <div className="flex-1">
              <Input
                value={step.title}
                onChange={(e) => handleStepChange(index, 'title', e.target.value)}
                placeholder="Step title"
                className="text-sm"
                required
              />
            </div>
            
            <div className="ml-2">
              <Select 
                value={step.status as string}
                onValueChange={(value) => {
                  handleStepChange(index, 'status', value as StepStatus);
                }}
              >
                <SelectTrigger className="h-9 w-32">
                  <SelectValue>
                    {renderStepStatusBadge(step.status)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Textarea
            value={step.description}
            onChange={(e) => handleStepChange(index, 'description', e.target.value)}
            placeholder="Step description"
            className="text-sm h-16 min-h-[4rem]"
          />
          
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => toggleAdvancedOptions(step.id)}
              className="px-0 text-sm h-auto"
            >
              {showAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}
            </Button>
            
            {step.is_converted && step.converted_task_id && (
              <span className="text-xs text-blue-600">
                Task created
              </span>
            )}
          </div>
          
          {showAdvanced && (
            <div className="space-y-3 pt-2 border-t mt-2">
              <div className="grid grid-cols-2 gap-3">
                <Select 
                  value={step.priority as string}
                  onValueChange={(value) => {
                    handleStepChange(index, 'priority', value as Priority);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low Priority</SelectItem>
                    <SelectItem value="normal">Normal Priority</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                  </SelectContent>
                </Select>
                
                {!step.is_converted && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleStepChange(index, 'needsImmediateTask', true)}
                    className="text-sm"
                  >
                    Create Task for This Step
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {renderDatePicker(
                  step.assigned_date,
                  (date) => handleStepChange(index, 'assigned_date', date),
                  "Assigned Date"
                )}
                
                {renderDatePicker(
                  step.due_date,
                  (date) => handleStepChange(index, 'due_date', date),
                  "Due Date"
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 ml-2">
          {index > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleMoveStep(index, 'up')}
              title="Move step up"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
          {index < steps.length - 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleMoveStep(index, 'down')}
              title="Move step down"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-red-500 hover:text-red-600"
            onClick={() => handleRemoveStep(index)}
            title="Remove step"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {index < steps.length - 1 && (
        <div className="flex justify-center mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleAddStep(index)}
            className="text-blue-600 hover:text-blue-700 text-xs py-1 h-auto"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add step here
          </Button>
        </div>
      )}
    </div>
  );
};

return (
  <Dialog 
    open={open} 
    onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) {
        resetForm();
        if (onClose) onClose();
      }
    }}
  >
    <DialogTrigger asChild>
      {!isEditing ? (
        <Button className="bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      ) : null}
    </DialogTrigger>
    <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Project' : 'Create New Project'}</DialogTitle>
        <DialogDescription>
          {isEditing ? 'Update project details and steps.' : 'Create a new project with sequential steps.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {workflowWarning && (
            <Alert>
              <AlertCircle className="h-4 w-4 mr-2" />
              <AlertDescription>{workflowWarning}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="title">Project Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter project title"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select 
                value={priority as string}
                onValueChange={(value: string) => {
                  if (value === 'low' || value === 'normal' || value === 'high') {
                    setPriority(value as Priority);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={status as string}
                onValueChange={(val: string) => {
                  setStatus(val as ProjectStatus);
                  if (val === 'completed' && !isEditing) {
                    setError("New projects cannot be created with completed status");
                    setStatus('active');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Project Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the project goals"
              className="h-20"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Project Steps</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddStep()}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Step
              </Button>
            </div>

            <div className="max-h-96 overflow-y-auto border rounded-lg divide-y">
              {steps.map((step, index) => renderStep(step, index))}
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 mt-6"
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? (isEditing ? "Saving..." : "Creating...") 
              : (isEditing ? "Save Changes" : "Create Project")
            }
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
);
};

export default ProjectEntryForm;