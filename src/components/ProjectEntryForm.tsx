import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, GripVertical, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Priority, ProjectStatus, StepStatus } from '@/lib/types';

async function convertNextStepToTask(projectId: string, steps: StepData[], user: any, supabase: any) {
  const now = new Date().toISOString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find the first non-completed, non-converted step
  const nextStep = steps.find(step => 
    step.status !== 'completed' && 
    !step.is_converted
  );

  if (!nextStep) {
    console.log('No eligible steps to convert to task');
    return;
  }

  try {
    // Create new item for the task
    const { data: taskItemData, error: taskItemError } = await supabase
      .from('items')
      .insert([{
        title: nextStep.title.trim(),
        user_id: user?.id,
        item_type: 'task',
        created_at: now,
        updated_at: now,
        is_archived: false
      }])
      .select()
      .single();

    if (taskItemError) throw taskItemError;

    // Create the task
    const { error: taskError } = await supabase
      .from('tasks')
      .insert([{
        id: taskItemData.id,
        status: 'on_deck',
        description: nextStep.description?.trim() || null,
        priority: 'normal',
        due_date: tomorrow.toISOString(),
        assigned_date: now,
        project_id: projectId,  // Link task back to project
        is_project_converted: true
      }]);

    if (taskError) throw taskError;

    // Update the step to mark it as converted
    const { error: updateStepError } = await supabase
      .from('project_steps')
      .update({
        is_converted: true,
        converted_task_id: taskItemData.id,
        updated_at: now
      })
      .eq('id', nextStep.id);

    if (updateStepError) throw updateStepError;

    console.log('Successfully converted step to task:', taskItemData.id);
    return taskItemData.id;
  } catch (error) {
    console.error('Error converting step to task:', error);
    throw error;
  }
}
interface StepData {
  id: string;
  title: string;
  description: string;
  order_number: number;
  status: StepStatus;
  is_converted: boolean;
  converted_task_id: string | null;
}

interface ProjectEntryFormProps {
  onProjectCreated?: (project: any) => void;
  initialData?: any;
  isEditing?: boolean;
  onClose?: () => void;
}

export function ProjectEntryForm({ 
  onProjectCreated, 
  initialData,
  isEditing = false,
  onClose 
}: ProjectEntryFormProps) {
  const { user } = useSupabaseAuth();
  const supabase = createClientComponentClient();
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
      is_converted: false,
      converted_task_id: null
    },
    {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      order_number: 1,
      status: 'pending',
      is_converted: false,
      converted_task_id: null
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        is_converted: false,
        converted_task_id: null
      },
      {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        order_number: 1,
        status: 'pending',
        is_converted: false,
        converted_task_id: null
      }
    ]);
    setError(null);
  };

  useEffect(() => {
    if (initialData && isEditing) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setPriority(initialData.priority || 'normal');
      setStatus(initialData.status || 'active');
      if (initialData.steps) {
        setSteps(initialData.steps.map((step: any, index: number) => ({
          id: step.id,
          title: step.title,
          description: step.description || '',
          order_number: index,
          status: step.status || 'pending',
          is_converted: step.is_converted || false,
          converted_task_id: step.converted_task_id || null
        })));
      }
    }
  }, [initialData, isEditing]);

  const handleAddStep = (afterIndex?: number) => {
    const newSteps = [...steps];
    const insertIndex = typeof afterIndex === 'number' ? afterIndex + 1 : steps.length;
    
    newSteps.splice(insertIndex, 0, {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      order_number: insertIndex,
      status: 'pending',
      is_converted: false,
      converted_task_id: null
    });

    for (let i = insertIndex + 1; i < newSteps.length; i++) {
      newSteps[i].order_number = i;
    }

    setSteps(newSteps);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length > 1) {
      const newSteps = steps.filter((_, i) => i !== index)
        .map((step, i) => ({
          ...step,
          order_number: i
        }));
      setSteps(newSteps);
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

    if (steps.some(step => !step.title.trim())) {
      setError('All steps must have a title');
      setIsSubmitting(false);
      return;
    }

    try {
      const now = new Date().toISOString();

      if (isEditing && initialData) {
        const now = new Date().toISOString();
        
        // Update the item
        const { error: itemError } = await supabase
          .from('items')
          .update({
            title: title.trim(),
            updated_at: now
          })
          .eq('id', initialData.id);
      
        if (itemError) throw itemError;
      
        // Update the project
        const { error: projectError } = await supabase
          .from('projects')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            status: status,
            priority: priority,
            updated_at: now
          })
          .eq('id', initialData.id);
      
        if (projectError) throw projectError;
      
        // Get existing steps
        const { data: existingSteps, error: stepsError } = await supabase
          .from('project_steps')
          .select('*')
          .eq('project_id', initialData.id);
      
        if (stepsError) throw stepsError;
      
        // Create sets of step IDs for comparison
        const existingStepIds = new Set(existingSteps?.map(step => step.id) || []);
        const newStepIds = new Set(steps.map(step => step.id));
      
        // Steps to delete (exist in DB but not in form)
        const stepsToDelete = existingSteps?.filter(step => !newStepIds.has(step.id)) || [];
        
        // Steps to create (exist in form but not in DB)
        const stepsToCreate = steps.filter(step => !existingStepIds.has(step.id));
        
        // Steps to update (exist in both)
        const stepsToUpdate = steps.filter(step => existingStepIds.has(step.id));
      
        // Delete removed steps
        if (stepsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('project_steps')
            .delete()
            .in('id', stepsToDelete.map(step => step.id));
      
          if (deleteError) throw deleteError;
        }
      
        // Create new steps
        if (stepsToCreate.length > 0) {
          const { error: createError } = await supabase
            .from('project_steps')
            .insert(
              stepsToCreate.map(step => ({
                project_id: initialData.id,
                title: step.title.trim(),
                description: step.description.trim() || null,
                order_number: step.order_number,
                status: step.status || 'pending',
                created_at: now,
                updated_at: now
              }))
            );
      
          if (createError) throw createError;
        }
      
        // Update existing steps
        for (const step of stepsToUpdate) {
          const { error: updateError } = await supabase
            .from('project_steps')
            .update({
              title: step.title.trim(),
              description: step.description.trim() || null,
              order_number: step.order_number,
              status: step.status,
              updated_at: now
            })
            .eq('id', step.id);
      
          if (updateError) throw updateError;
        }
      
                // Try to convert the next step to a task
                try {
                  await convertNextStepToTask(initialData.id, steps, user, supabase);
                } catch (error) {
                  console.error('Error in step to task conversion:', error);
                  // We don't throw here since the main update was successful
                }
        
                if (onProjectCreated) {
                  onProjectCreated({ id: initialData.id });
                }
      }
       else {
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
            status: status,
            priority: priority,
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
        const stepsToInsert = steps.map(step => ({
          project_id: itemData.id,
          title: step.title.trim(),
          description: step.description.trim() || null,
          order_number: step.order_number,
          status: 'pending',
          is_converted: false,
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
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

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
            priority: 'normal',
            due_date: tomorrow.toISOString(),
            assigned_date: now
          }]);

        if (taskError) throw taskError;

        // Update the first step to mark it as converted
        const { error: updateStepError } = await supabase
          .from('project_steps')
          .update({
            is_converted: true,
            converted_task_id: taskItemData.id
          })
          .eq('project_id', itemData.id)
          .eq('order_number', 0);

        if (updateStepError) throw updateStepError;

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select 
                 value={priority ?? 'normal'} 
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
                value={status} 
                onValueChange={(value: string) => {
                  if (value === 'active' || value === 'on_hold' || value === 'completed') {
                    setStatus(value as ProjectStatus);
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
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

            {steps.map((step, index) => (
              <div
                key={step.id}
                className="border rounded-lg p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                    <h4 className="text-sm font-medium">Step {index + 1}</h4>
                  </div>
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

                  {index < steps.length - 1 && (
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddStep(index)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add step here
                      </Button>
                    </div>
                  )}
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
}