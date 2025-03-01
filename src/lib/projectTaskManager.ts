// src/lib/projectTaskManager.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database.types';
import type { Priority, ProjectStatus, StepStatus } from '@/lib/types';

export interface ProjectStep {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  order_number: number;
  status: StepStatus;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  priority?: Priority | null;
  due_date?: string | null;
  assigned_date?: string | null;
  is_converted: boolean;
  converted_task_id: string | null;
  needsImmediateTask?: boolean;
}

export interface ProjectTaskManagerParams {
  supabase: any;
  userId: string | null;
}

export class ProjectTaskManager {
  private supabase;
  private userId;

  constructor({ supabase, userId }: ProjectTaskManagerParams) {
    this.supabase = supabase;
    this.userId = userId;
  }

  /**
   * Creates a task for a project step
   */
  async createTaskForStep(step: ProjectStep, projectId: string): Promise<string | null> {
    if (!this.userId) return null;
    
    try {
      // Check if a task already exists for this step
      if (step.is_converted && step.converted_task_id) {
        const { data: existingTask } = await this.supabase
          .from('tasks')
          .select('id')
          .eq('id', step.converted_task_id)
          .single();

        if (existingTask) {
          console.log(`Task already exists for step ${step.id}`);
          return existingTask.id;
        }
      }

      const now = new Date().toISOString();
      
      // Calculate a sensible due date (7 days from now by default)
      const dueDate = step.due_date || null;

      // Create the task item
      const { data: taskItemData, error: taskItemError } = await this.supabase
        .from('items')
        .insert([{
          title: step.title.trim(),
          user_id: this.userId,
          item_type: 'task',
          created_at: now,
          updated_at: now,
          is_archived: false
        }])
        .select()
        .single();

      if (taskItemError) throw taskItemError;

      // Create the task
      const { error: taskError } = await this.supabase
        .from('tasks')
        .insert([{
          id: taskItemData.id,
          status: step.status === 'completed' ? 'completed' : 'on_deck',
          description: step.description?.trim() || null,
          priority: step.priority || 'normal',
          due_date: dueDate,
          assigned_date: step.assigned_date || now,
          project_id: projectId,
          is_project_converted: true
        }]);

      if (taskError) throw taskError;

      // Update the step
      const { error: updateStepError } = await this.supabase
        .from('project_steps')
        .update({
          is_converted: true,
          converted_task_id: taskItemData.id,
          updated_at: now
        })
        .eq('id', step.id);

      if (updateStepError) throw updateStepError;

      console.log(`Created task ${taskItemData.id} for step ${step.id}`);
      return taskItemData.id;
    } catch (error) {
      console.error('Error creating task for step:', error);
      throw error;
    }
  }

  /**
   * When a task is completed, update the project step and create next task
   */
  async handleTaskCompletion(taskId: string, projectId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      // Update project step
      const { data: updatedStep, error: stepError } = await this.supabase
        .from('project_steps')
        .update({ 
          status: 'completed',
          completed_at: now
        })
        .eq('converted_task_id', taskId)
        .select()
        .single();

      if (stepError) {
        console.error('Error updating step status:', stepError);
        // Continue with next step creation even if this fails
      }

      // Get all project steps in order
      const { data: projectSteps, error: stepsError } = await this.supabase
        .from('project_steps')
        .select('*')
        .eq('project_id', projectId)
        .order('order_number', { ascending: true });

      if (stepsError) throw stepsError;
      if (!projectSteps || projectSteps.length === 0) return;

      // Find the completed step's index
      const completedStepIndex = projectSteps.findIndex((step: ProjectStep) => 
        step.converted_task_id === taskId
      );
      
      if (completedStepIndex === -1) {
        console.warn('Could not find completed step in project steps');
        return;
      }
      
      // Find the next step to convert to a task
      // It should be the next step in sequence that isn't already converted
      let nextStepToConvert = null;
      
      for (let i = completedStepIndex + 1; i < projectSteps.length; i++) {
        if (!projectSteps[i].is_converted) {
          nextStepToConvert = projectSteps[i];
          break;
        }
      }

      if (nextStepToConvert) {
        await this.createTaskForStep(nextStepToConvert as ProjectStep, projectId);
      } else {
        // Check if all steps are now completed
        const allCompleted = projectSteps.every((step: ProjectStep) => step.status === 'completed');
        
        if (allCompleted) {
          // Update project status to completed
          const progress = 100;
          await this.supabase
            .from('projects')
            .update({ 
              status: 'completed',
              completed_at: now,
              progress
            })
            .eq('id', projectId);
            
          console.log(`All steps completed, marked project ${projectId} as completed`);
        } else {
          // Update progress
          const completedSteps = projectSteps.filter((step: ProjectStep) => step.status === 'completed').length;
          const progress = Math.round((completedSteps / projectSteps.length) * 100);
          
          await this.supabase
            .from('projects')
            .update({ progress })
            .eq('id', projectId);
            
          console.log(`Updated project ${projectId} progress to ${progress}%`);
        }
      }
    } catch (error) {
      console.error('Error handling task completion:', error);
      throw error;
    }
  }

  /**
   * When a task is uncompleted, also update the step
   */
  async handleTaskUncomplete(taskId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      // Update project step
      const { data: updatedStep, error: stepError } = await this.supabase
        .from('project_steps')
        .update({ 
          status: 'in_progress',
          completed_at: null,
          updated_at: now
        })
        .eq('converted_task_id', taskId)
        .select()
        .single();

      if (stepError) throw stepError;
      
      if (updatedStep?.project_id) {
        // Update project progress
        await this.updateProjectProgress(updatedStep.project_id);
      }
    } catch (error) {
      console.error('Error uncompleting step:', error);
      throw error;
    }
  }

  /**
   * Calculate and update project progress
   */
  async updateProjectProgress(projectId: string): Promise<number> {
    try {
      // Get all steps for the project
      const { data: steps, error: stepsError } = await this.supabase
        .from('project_steps')
        .select('status')
        .eq('project_id', projectId);
        
      if (stepsError) throw stepsError;
      if (!steps || steps.length === 0) return 0;
      
      // Calculate progress
      const completedSteps = steps.filter((step: { status: string }) => step.status === 'completed').length;
      const progress = Math.round((completedSteps / steps.length) * 100);
      
      // Update project
      const { error: updateError } = await this.supabase
        .from('projects')
        .update({ progress })
        .eq('id', projectId);
        
      if (updateError) throw updateError;
      
      return progress;
    } catch (error) {
      console.error('Error updating project progress:', error);
      throw error;
    }
  }

  /**
   * Sync all project steps with tasks
   */
  async syncProjectSteps(projectId: string): Promise<void> {
    try {
      // First check if the project is on hold - if so, don't sync
        const { data: project, error: projectError } = await this.supabase
        .from('projects')
        .select('status')
        .eq('id', projectId)
        .single();
        
      if (projectError) throw projectError;
          // If project is on hold, don't create any new tasks
      if (project?.status === 'on_hold') {
      console.log(`Project ${projectId} is on hold, skipping task sync`);
      return;
        }

      // Get all project steps
      const { data: steps, error: stepsError } = await this.supabase
        .from('project_steps')
        .select('*')
        .eq('project_id', projectId)
        .order('order_number', { ascending: true });

      if (stepsError) throw stepsError;
      if (!steps || steps.length === 0) return;

      // Check for inconsistencies and fix them
      for (const step of steps as ProjectStep[]) {
        if (step.is_converted && step.converted_task_id) {
          // Check if the task still exists
          const { data: task, error: taskError } = await this.supabase
            .from('tasks')
            .select('*')
            .eq('id', step.converted_task_id)
            .single();

          if (taskError) {
            console.log(`Task ${step.converted_task_id} for step ${step.id} does not exist, resetting step`);
            
            // Task doesn't exist anymore, reset step
            await this.supabase
              .from('project_steps')
              .update({
                is_converted: false,
                converted_task_id: null,
                status: 'pending',
                updated_at: new Date().toISOString()
              })
              .eq('id', step.id);
          } else if (task) {
            // Task exists, check for status consistency
            if (task.status === 'completed' && step.status !== 'completed') {
              // Task is completed but step isn't, sync them
              await this.supabase
                .from('project_steps')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString()
                })
                .eq('id', step.id);
                
              console.log(`Synced completed task ${task.id} status to step ${step.id}`);
            } else if (task.status !== 'completed' && step.status === 'completed') {
              // Step is completed but task isn't, sync them
              await this.supabase
                .from('tasks')
                .update({
                  status: 'completed',
                  updated_at: new Date().toISOString()
                })
                .eq('id', step.converted_task_id);
                
              console.log(`Synced completed step ${step.id} status to task ${task.id}`);
            }
          }
        }
      }

      // Find the first non-converted step that should have a task
      // It must come after all completed steps and have no incomplete steps before it
      let currentStepIndex = 0;
      
      // Find the last completed or in-progress step
      for (let i = 0; i < steps.length; i++) {
        if (steps[i].status === 'completed' || steps[i].status === 'in_progress') {
          currentStepIndex = i + 1; // The next step should be the current one
        } else {
          break; // Stop at the first non-completed/in-progress step
        }
      }
      
      // If we found a valid next step, and it's not already converted, create a task for it
      if (currentStepIndex < steps.length) {
        const nextStep = steps[currentStepIndex];
        
        if (!nextStep.is_converted) {
          console.log(`Creating task for next step ${nextStep.id}`);
          await this.createTaskForStep(nextStep as ProjectStep, projectId);
        }
      }
      
      // Update project progress
      await this.updateProjectProgress(projectId);
    } catch (error) {
      console.error('Error syncing project steps:', error);
      throw error;
    }
  }

  /**
   * Handle task deletion
   */
  async handleTaskDeletion(taskId: string): Promise<void> {
    try {
      // Check if it's a project task
      const { data: task, error: taskError } = await this.supabase
        .from('tasks')
        .select('project_id')
        .eq('id', taskId)
        .single();
  
      if (taskError || !task?.project_id) return;
  
      // Check project status first
      const { data: project, error: projectError } = await this.supabase
        .from('projects')
        .select('status')
        .eq('id', task.project_id)
        .single();
        
      if (projectError) throw projectError;
      
      // If project is on hold, just update the step status but don't create a new task
      const isProjectOnHold = project?.status === 'on_hold';
  
      // Update the corresponding step
      const { data: step, error: stepError } = await this.supabase
        .from('project_steps')
        .update({
          is_converted: false,
          converted_task_id: null,
          // If step was completed, keep it completed even if the task is deleted
          updated_at: new Date().toISOString()
        })
        .eq('converted_task_id', taskId)
        .select()
        .single();
  
      if (stepError) throw stepError;
  
      // Sync project steps to create a new task if needed, but only if project is not on hold
      if (!isProjectOnHold && step?.project_id) {
        await this.syncProjectSteps(task.project_id);
      }
    } catch (error) {
      console.error('Error handling task deletion:', error);
      throw error;
    }
  }
  
  /**
   * Get all tasks associated with a project
   */
  async getProjectTasks(projectId: string) {
    try {
      // Get all steps with task associations
      const { data: steps, error: stepsError } = await this.supabase
        .from('project_steps')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_converted', true)
        .order('order_number', { ascending: true });
        
      if (stepsError) throw stepsError;
      if (!steps || steps.length === 0) return [];
      
      // Get the tasks
      const { data: tasks, error: tasksError } = await this.supabase
        .from('tasks')
        .select(`
          *,
          items:id (*)
        `)
        .in('id', steps.map((step: ProjectStep) => step.converted_task_id).filter(Boolean));
        
      if (tasksError) throw tasksError;
      
      // Combine step and task data
      return steps
        .filter((step: ProjectStep) => step.converted_task_id)
        .map((step: ProjectStep) => {
          const matchingTask = tasks?.find((task: any) => task.id === step.converted_task_id);
          if (!matchingTask) return null;
          
          return {
            ...matchingTask,
            step: {
              id: step.id,
              title: step.title,
              description: step.description,
              status: step.status,
              order_number: step.order_number
            }
          };
        })
        .filter(Boolean);
    } catch (error) {
      console.error('Error getting project tasks:', error);
      throw error;
    }
  }
}

// Export a factory function to create a ProjectTaskManager instance
export function createProjectTaskManager(params: ProjectTaskManagerParams): ProjectTaskManager {
  return new ProjectTaskManager(params);
}