import React, { useState } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Trash2, PauseCircle, CheckCircle, Copy } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectEntryForm } from '@/components/ProjectEntryForm';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { ProjectWithDetails } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ProjectTaskManager } from '@/lib/projectTaskManager';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

interface ActiveProjectsCardProps {
  activeProjects: ProjectWithDetails[];
  onProjectUpdate: () => void;
}

const ActiveProjectsCard: React.FC<ActiveProjectsCardProps> = ({ 
  activeProjects,
  onProjectUpdate
}) => {
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  const supabase = createClientComponentClient();
  const { user } = useSupabaseAuth();
  
  // Delete project and all associated tasks
  const deleteProject = async (projectId: string) => {
    try {
      setIsDeleting(prev => ({ ...prev, [projectId]: true }));
      
      // Step 1: Confirm with user
      const confirmDelete = window.confirm(
        "Are you sure you want to delete this project? This will delete all project steps and associated tasks. This action cannot be undone."
      );
      
      if (!confirmDelete) {
        setIsDeleting(prev => ({ ...prev, [projectId]: false }));
        return;
      }
      
      // Step 2: Get all project steps to find associated tasks
      const { data: steps, error: stepsError } = await supabase
        .from('project_steps')
        .select('converted_task_id')
        .eq('project_id', projectId)
        .not('converted_task_id', 'is', null);
        
      if (stepsError) throw stepsError;
      
      // Step 3: Delete all tasks created from project steps
      const taskIds = steps?.map(step => step.converted_task_id).filter(Boolean) || [];
      
      if (taskIds.length > 0) {
        // Delete tasks records
        const { error: tasksDeleteError } = await supabase
          .from('tasks')
          .delete()
          .in('id', taskIds);
          
        if (tasksDeleteError) throw tasksDeleteError;
        
        // Delete task items
        const { error: itemsDeleteError } = await supabase
          .from('items')
          .delete()
          .in('id', taskIds);
          
        if (itemsDeleteError) throw itemsDeleteError;
      }
      
      // Step 4: Delete project steps
      const { error: stepsDeleteError } = await supabase
        .from('project_steps')
        .delete()
        .eq('project_id', projectId);
        
      if (stepsDeleteError) throw stepsDeleteError;
      
      // Step 5: Delete project
      const { error: projectDeleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);
        
      if (projectDeleteError) throw projectDeleteError;
      
      // Step 6: Delete project item
      const { error: itemDeleteError } = await supabase
        .from('items')
        .delete()
        .eq('id', projectId);
        
      if (itemDeleteError) throw itemDeleteError;
      
      // Update UI
      onProjectUpdate();
      
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    } finally {
      setIsDeleting(prev => ({ ...prev, [projectId]: false }));
    }
  };
  
  // Function to change project status to on-hold
  const putProjectOnHold = async (projectId: string) => {
    try {
      setIsDeleting(prev => ({ ...prev, [projectId]: true }));
      const now = new Date().toISOString();
      
      // Find the project
      const project = activeProjects.find(p => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Confirm with user
      const confirmOnHold = window.confirm(
        "Putting this project on hold will delete any active or pending tasks associated with it. " +
        "Continue?"
      );
      
      if (!confirmOnHold) {
        setIsDeleting(prev => ({ ...prev, [projectId]: false }));
        return;
      }
        
      // Clean up non-completed tasks
      await cleanupNonCompletedTasks(projectId);
      
      // Update project status
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          status: 'on_hold',
          updated_at: now
        })
        .eq('id', projectId);
        
      if (updateError) throw updateError;
      
      // Update item
      const { error: itemError } = await supabase
        .from('items')
        .update({
          updated_at: now
        })
        .eq('id', projectId);
        
      if (itemError) throw itemError;
      
      // Update UI
      onProjectUpdate();
      
    } catch (error) {
      console.error('Error putting project on hold:', error);
      alert('Failed to update project status. Please try again.');
    } finally {
      setIsDeleting(prev => ({ ...prev, [projectId]: false }));
    }
  };
  
  // Function to mark project as completed
  const markProjectCompleted = async (projectId: string) => {
    try {
      setIsDeleting(prev => ({ ...prev, [projectId]: true }));
      const now = new Date().toISOString();
      
      // Find the project
      const project = activeProjects.find(p => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Confirm with user
      const confirmComplete = window.confirm(
        "Mark all steps as completed and complete the project?"
      );
      
      if (!confirmComplete) {
        setIsDeleting(prev => ({ ...prev, [projectId]: false }));
        return;
      }
      
      // Mark all steps as completed
      const { error: stepsError } = await supabase
        .from('project_steps')
        .update({
          status: 'completed',
          completed_at: now
        })
        .eq('project_id', projectId);
        
      if (stepsError) throw stepsError;
      
      // Update project status
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          status: 'completed',
          completed_at: now,
          progress: 100,
          updated_at: now
        })
        .eq('id', projectId);
        
      if (updateError) throw updateError;
      
      // Update item
      const { error: itemError } = await supabase
        .from('items')
        .update({
          updated_at: now
        })
        .eq('id', projectId);
        
      if (itemError) throw itemError;
      
      // Update UI
      onProjectUpdate();
      
    } catch (error) {
      console.error('Error completing project:', error);
      alert('Failed to complete project. Please try again.');
    } finally {
      setIsDeleting(prev => ({ ...prev, [projectId]: false }));
    }
  };
  
  // Helper function to clean up non-completed tasks for a project
  const cleanupNonCompletedTasks = async (projectId: string) => {
    try {
      // First, get all project steps with tasks
      const { data: stepsWithTasks } = await supabase
        .from('project_steps')
        .select('id, converted_task_id, is_converted')
        .eq('project_id', projectId)
        .eq('is_converted', true)
        .not('converted_task_id', 'is', null);
        
      // Get all non-completed tasks for the project
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('project_id', projectId)
        .neq('status', 'completed');
      
      if (!tasks || tasks.length === 0) return;
      
      // Reset steps
      const { error: resetStepsError } = await supabase
        .from('project_steps')
        .update({
          is_converted: false,
          converted_task_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('project_id', projectId)
        .in('is_converted', [true])
        .neq('status', 'completed');
      
      if (resetStepsError) {
        console.error('Error resetting steps:', resetStepsError);
      }
      
      // Delete tasks
      for (const task of tasks) {
        // Delete the task
        await supabase.from('tasks').delete().eq('id', task.id);
        
        // Delete the item
        await supabase.from('items').delete().eq('id', task.id);
      }
    } catch (error) {
      console.error('Error cleaning up project tasks:', error);
      throw error;
    }
  };
  
  // Function to duplicate a project
  const duplicateProject = async (projectId: string) => {
    try {
      setIsDeleting(prev => ({ ...prev, [projectId]: true }));
      const now = new Date().toISOString();
      
      // Find the project
      const project = activeProjects.find(p => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }
      
      // Create a new item for the project
      const { data: newItem, error: itemError } = await supabase
        .from('items')
        .insert([{
          title: `${project.title} (Copy)`,
          user_id: project.item.user_id,
          item_type: 'project',
          created_at: now,
          updated_at: now,
          is_archived: false
        }])
        .select()
        .single();
        
      if (itemError) throw itemError;
      if (!newItem) throw new Error('Failed to create new project item');
      
      // Create a new project
      const { error: projectError } = await supabase
        .from('projects')
        .insert([{
          id: newItem.id,
          status: 'active', // Always start as active
          progress: 0,
          description: project.description,
          current_step: 0,
          priority: project.priority,
          user_id: project.user_id,
          created_at: now,
          updated_at: now
        }]);
        
      if (projectError) throw projectError;
      
      // Duplicate steps
      if (project.steps && project.steps.length > 0) {
        const stepsToInsert = project.steps.map(step => ({
          project_id: newItem.id,
          title: step.title,
          description: step.description,
          order_number: step.order_number,
          status: 'pending', // Reset status to pending
          priority: step.priority,
          is_converted: false,
          converted_task_id: null,
          created_at: now,
          updated_at: now
        }));
        
        const { error: stepsError } = await supabase
          .from('project_steps')
          .insert(stepsToInsert);
          
        if (stepsError) throw stepsError;
      }
      
      // Update UI
      onProjectUpdate();
      
    } catch (error) {
      console.error('Error duplicating project:', error);
      alert('Failed to duplicate project. Please try again.');
    } finally {
      setIsDeleting(prev => ({ ...prev, [projectId]: false }));
    }
  };

  // Function to sync project tasks and steps
  const syncProjectTasks = async (projectId: string) => {
    try {
      setIsDeleting(prev => ({ ...prev, [projectId]: true }));
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Create a ProjectTaskManager instance to handle task syncing
      const projectTaskManager = new ProjectTaskManager({
        supabase,
        userId: user.id
      });
      
      await projectTaskManager.syncProjectSteps(projectId);
      
      // Update UI
      onProjectUpdate();
      
    } catch (error) {
      console.error('Error syncing project tasks:', error);
      alert('Failed to sync project tasks. Please try again.');
    } finally {
      setIsDeleting(prev => ({ ...prev, [projectId]: false }));
    }
  };

  // Format date: "Created Jan 15, 2025"
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `Created ${format(date, 'MMM d, yyyy')}`;
  };

  // Calculate days since creation
  const getDaysSinceCreation = (dateString: string) => {
    const createdDate = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get priority badge with appropriate color
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800">High Priority</Badge>;
      case 'low':
        return <Badge className="bg-gray-100 text-gray-800">Low Priority</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800">Normal Priority</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {activeProjects.length === 0 ? (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 text-center text-gray-500">
            No active projects. Create one to get started!
          </div>
        </div>
      ) : (
        activeProjects.map(project => (
          <div 
            key={project.id} 
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{project.title}</h2>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                  {project.priority && getPriorityBadge(project.priority)}
                </div>
                
                <p className="text-gray-600 mt-2">
                  {project.description || 'No description'}
                </p>
                
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-4">
                  <div>{formatDate(project.created_at)}</div>
                  <div>{getDaysSinceCreation(project.created_at)} days active</div>
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    disabled={isDeleting[project.id]}
                  >
                    {isDeleting[project.id] ? 
                      <span className="px-2">Processing...</span> : 
                      <MoreHorizontal className="h-5 w-5" />
                    }
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => setProjectToEdit(project)}
                    disabled={isDeleting[project.id]}
                  >
                    Edit Project
                  </DropdownMenuItem>
                  
                  {/* Status change options */}
                  <DropdownMenuItem 
                    onClick={() => putProjectOnHold(project.id)}
                    disabled={isDeleting[project.id]}
                  >
                    <PauseCircle className="h-4 w-4 mr-2 text-yellow-600" />
                    Put On Hold
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={() => markProjectCompleted(project.id)}
                    disabled={isDeleting[project.id]}
                  >
                    <CheckCircle className="h-4 w-4 mr-2 text-blue-600" />
                    Mark Completed
                  </DropdownMenuItem>
                  
                  {/* Project management options */}
                  <DropdownMenuItem 
                    onClick={() => syncProjectTasks(project.id)}
                    disabled={isDeleting[project.id]}
                  >
                    <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                    Sync Project Tasks
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={() => duplicateProject(project.id)}
                    disabled={isDeleting[project.id]}
                  >
                    <Copy className="h-4 w-4 mr-2 text-purple-600" />
                    Duplicate Project
                  </DropdownMenuItem>
                  
                  {/* Delete project - always at the bottom with a destructive style */}
                  <DropdownMenuItem 
                    onClick={() => deleteProject(project.id)}
                    disabled={isDeleting[project.id]}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {project.steps && project.steps.length > 0 && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm font-medium text-gray-700">Progress</div>
                  <div className="text-sm text-gray-500">
                    {project.progress || 0}% Complete
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${project.progress || 0}%` }}
                  />
                </div>
                
                {/* Show current step if available */}
                {project.steps.length > 0 && (
                  <div className="mt-4 bg-blue-50 p-3 rounded-md">
                    <div className="text-sm font-medium text-gray-700 mb-1">Current Step</div>
                    {project.steps
                      .filter(step => step.status !== 'completed')
                      .sort((a, b) => a.order_number - b.order_number)
                      .slice(0, 1)
                      .map(step => (
                        <div key={step.id} className="text-sm text-gray-600">
                          {step.title}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
      
      {projectToEdit && (
        <ProjectEntryForm
          initialData={projectToEdit}
          isEditing={true}
          onProjectCreated={() => {
            onProjectUpdate();
            setProjectToEdit(null);
          }}
          onClose={() => setProjectToEdit(null)}
        />
      )}
    </div>
  );
};

export default ActiveProjectsCard;