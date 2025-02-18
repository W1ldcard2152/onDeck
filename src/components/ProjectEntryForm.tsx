import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarIcon, Plus, GripVertical, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import type { Priority, ProjectStep, StepData, StepStatus } from '@/lib/types';

interface ProjectEntryFormProps {
  onProjectCreated?: (project: any) => void;
  initialData?: any;
  isEditing?: boolean;
  onClose?: () => void;
}

export const ProjectEntryForm: React.FC<ProjectEntryFormProps> = ({ 
  onProjectCreated, 
  initialData,
  isEditing = false,
  onClose 
}) => {
  const { user } = useSupabaseAuth();
  const supabase = createClientComponentClient();
  const [open, setOpen] = useState(isEditing);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<StepData[]>([
    {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      priority: 'normal' as Priority,
      due_date: undefined,
      assigned_date: undefined,
      status: 'pending' as StepStatus,
      order_number: 0,  // Changed from order
      is_converted: false,
      converted_task_id: null
    },
    {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      priority: 'normal' as Priority,
      due_date: undefined,
      assigned_date: undefined,
      status: 'pending' as StepStatus,
      order_number: 1,  // Changed from order
      is_converted: false,
      converted_task_id: null
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with project data when editing
  useEffect(() => {
    if (initialData && isEditing) {
        setTitle(initialData.title);
        setDescription(initialData.description || '');
        if (initialData.steps) {
          setSteps(initialData.steps.map((step: ProjectStep, index: number) => ({
            id: step.id,
            title: step.title,
            description: step.description || '',
            priority: step.priority || 'normal',
            due_date: step.due_date ? new Date(step.due_date) : undefined,
            assigned_date: step.assigned_date ? new Date(step.assigned_date) : undefined,
            status: step.status || 'pending',
            order_number: index,  // Changed from order
            is_converted: step.is_converted,
            converted_task_id: step.converted_task_id
          })));
        }
      }
  }, [initialData, isEditing]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSteps([
      {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        priority: 'normal',
        due_date: undefined,
        assigned_date: undefined,
        status: 'pending' as StepStatus,
        order_number: 0,  // Changed from order
        is_converted: false,
        converted_task_id: null
      },
      {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        priority: 'normal',
        due_date: undefined,
        assigned_date: undefined,
        status: 'pending' as StepStatus,
        order_number: 1,  // Changed from order
        is_converted: false,
        converted_task_id: null
      }
    ]);
    setError(null);
  };

  const handleAddStep = () => {
    setSteps([...steps, {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      priority: 'normal' as Priority,
      due_date: undefined,
      assigned_date: undefined,
      status: 'pending' as StepStatus,
      order_number: steps.length,  // Changed from order
      is_converted: false,
      converted_task_id: null
    }]);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index));
    }
  };

  const handleStepChange = (index: number, field: keyof StepData, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = {
      ...newSteps[index],
      [field]: value
    };
    setSteps(newSteps);
  };

  const handleMoveStep = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= steps.length) return;
    
    const newSteps = [...steps];
    const [removed] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, removed);
    
    // Update order_number values after moving
    newSteps.forEach((step, index) => {
      step.order_number = index;
    });
    
    setSteps(newSteps);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!user) {
      setError('You must be logged in to create projects');
      setIsSubmitting(false);
      return;
    }

    // Validate steps
    if (steps.some(step => !step.title.trim())) {
      setError('All steps must have a title');
      setIsSubmitting(false);
      return;
    }

    try {
      const now = new Date().toISOString();

      if (isEditing && initialData) {
        // Update existing project logic here
      } else {
        // Create new project
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

        // Create the project
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .insert([{
            id: itemData.id,
            title: title.trim(),
            description: description.trim() || null,
            status: 'active',
            progress: 0,
            current_step: 0,
            user_id: user.id,
            created_at: now,
            updated_at: now
          }])
          .select()
          .single();

        if (projectError) throw projectError;

        // Create project steps
        const stepsToInsert = steps.map((step, index) => ({
            project_id: itemData.id,
            title: step.title.trim(),
            description: step.description.trim() || null,
            order_number: step.order_number,  // Changed from order
            status: 'pending',
            due_date: step.due_date?.toISOString() || null,
            assigned_date: step.assigned_date?.toISOString() || null,
            priority: step.priority,
            is_converted: index === 0,
            converted_task_id: null,
            created_at: now,
            updated_at: now
          }));

        const { error: stepsError } = await supabase
          .from('project_steps')
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;

        // Convert first step to task automatically
        const firstStep = steps[0];
        const { data: taskItemData, error: taskItemError } = await supabase
          .from('items')
          .insert([{
            title: firstStep.title.trim(),
            user_id: user.id,
            item_type: 'task',
            created_at: now,
            updated_at: now,
            is_archived: false
          }])
          .select()
          .single();

        if (taskItemError) throw taskItemError;

        const { error: taskError } = await supabase
          .from('tasks')
          .insert([{
            id: taskItemData.id,
            status: 'on_deck',
            description: firstStep.description.trim() || null,
            converted_project_id: itemData.id,
            priority: firstStep.priority,
            due_date: firstStep.due_date?.toISOString() || null,
            assigned_date: firstStep.assigned_date?.toISOString() || null
          }]);

        if (taskError) throw taskError;

        if (onProjectCreated) {
          onProjectCreated({ id: itemData.id });
        }
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

  const renderDatePicker = (
    selectedDate: Date | null | undefined,
    onDateChange: (date: Date | null | undefined) => void,
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
              selected={selectedDate || undefined}
              onSelect={onDateChange}
              showOutsideDays={true}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

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
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Project' : 'Create New Project'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update project details and steps.' : 'Create a new project with sequential steps.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Project Steps</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddStep}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Step
              </Button>
            </div>

            {steps.map((step, index) => (
              <div
                key={step.id}
                className="border rounded-lg p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Step {index + 1}</h4>
                  <div className="flex items-center gap-2">
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveStep(index, 'up')}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                    )}
                    {index < steps.length - 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveStep(index, 'down')}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    )}
                    {steps.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveStep(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Step Title</Label>
                    <Input
                      value={step.title}
                      onChange={(e) => handleStepChange(index, 'title', e.target.value)}
                      placeholder="Enter step title"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={step.description}
                      onChange={(e) => handleStepChange(index, 'description', e.target.value)}
                      placeholder="Describe what needs to be done"
                      className="h-20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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

                  <div className="space-y-2">
  <Label>Priority</Label>
  <Select
    value={step.priority || 'normal'} // Provide a default value if null/undefined
    onValueChange={(value: string) => {
      if (value === 'low' || value === 'normal' || value === 'high') {
        handleStepChange(index, 'priority', value as Priority);
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
                </div>
              </div>
            ))}
          </div>

          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? (isEditing ? "Saving..." : "Creating...") 
              : (isEditing ? "Save Changes" : "Create Project")
            }
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectEntryForm;