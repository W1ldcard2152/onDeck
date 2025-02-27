import React, { useState } from 'react';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, MoreHorizontal, Trash2, PauseCircle, PlayCircle, CheckCircle, Copy } from 'lucide-react';
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

interface OtherProjectsCardProps {
  onHoldProjects: ProjectWithDetails[];
  completedProjects: ProjectWithDetails[];
  onProjectUpdate: () => void;
}

const OtherProjectsCard: React.FC<OtherProjectsCardProps> = ({ 
  onHoldProjects, 
  completedProjects,
  onProjectUpdate
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  const supabase = createClientComponentClient();
  
  const totalCount = onHoldProjects.length + completedProjects.length;
  
  // Sort combined projects: on-hold first, then completed
  const sortedProjects = [
    ...onHoldProjects,
    ...completedProjects
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on_hold':
        return <Badge className="bg-yellow-100 text-yellow-800">On Hold</Badge>;
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800">Completed</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800">Active</Badge>;
    }
  };

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
  
  // Function to change project status (active/on-hold/completed)
  const updateProjectStatus = async (projectId: string, newStatus: 'active' | 'on_hold' | 'completed') => {
    try {
      setIsDeleting(prev => ({ ...prev, [projectId]: true }));
      const now = new Date().toISOString();
      
      // Find the project
      const project = [...onHoldProjects, ...completedProjects].find(p => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Handle special cases when changing status
      if (newStatus === 'on_hold' && project.status !== 'on_hold') {
        // Putting a project on hold
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
      }
      
      if (newStatus === 'completed' && project.status !== 'completed') {
        // Marking a project as completed
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
      }
      
      if (newStatus === 'active' && project.status !== 'active') {
        // If moving from completed back to active, check if all steps are completed
        if (project.status === 'completed') {
          const resetSteps = window.confirm(
            "This will reset the project as active. Do you want to mark the last step as in-progress?"
          );
          
          if (resetSteps) {
            // Find the last step that's completed and mark it as in-progress
            const { data: steps } = await supabase
              .from('project_steps')
              .select('*')
              .eq('project_id', projectId)
              .order('order_number', { ascending: false })
              .limit(1);
              
            if (steps && steps.length > 0) {
              await supabase
                .from('project_steps')
                .update({
                  status: 'in_progress',
                  completed_at: null
                })
                .eq('id', steps[0].id);
            }
          }
        }
      }
      
      // Update project status
      const projectUpdate: any = {
        status: newStatus,
        updated_at: now
      };
      
      // Additional fields based on new status
      if (newStatus === 'completed') {
        projectUpdate.completed_at = now;
        projectUpdate.progress = 100;
      } else if (newStatus === 'active') {
        projectUpdate.completed_at = null;
      }
      
      // Update project
      const { error: updateError } = await supabase
        .from('projects')
        .update(projectUpdate)
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
      console.error('Error updating project status:', error);
      alert('Failed to update project status. Please try again.');
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
      const project = [...onHoldProjects, ...completedProjects].find(p => p.id === projectId);
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

  // Format date: "Created Jan 15, 2025"
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `Created ${format(date, 'MMM d, yyyy')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div 
        className="px-6 py-4 border-b cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isExpanded ? 
              <ChevronDown className="h-5 w-5" /> : 
              <ChevronRight className="h-5 w-5" />
            }
            <h2 className="text-lg font-medium">On Hold & Completed Projects</h2>
            <Badge variant="secondary">{totalCount}</Badge>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-6">
          {totalCount === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No on-hold or completed projects
            </div>
          ) : (
            <div className="space-y-4">
              {sortedProjects.map(project => (
                <div 
                  key={project.id} 
                  className={cn(
                    "p-4 border rounded-lg",
                    project.status === 'on_hold' ? "border-yellow-200 bg-yellow-50/30" : "border-gray-200"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{project.title}</h3>
                        {getStatusBadge(project.status)}
                      </div>
                      
                      <p className="text-sm text-gray-500 mt-1">
                        {project.description || 'No description'}
                      </p>
                      
                      <div className="text-xs text-gray-500 mt-2">
                        {formatDate(project.created_at)}
                        {project.completed_at && (
                          <span className="ml-4">
                            Completed {format(new Date(project.completed_at), 'MMM d, yyyy')}
                          </span>
                        )}
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
                            <MoreHorizontal className="h-4 w-4" />
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
                        {project.status !== 'active' && (
                          <DropdownMenuItem 
                            onClick={() => updateProjectStatus(project.id, 'active')}
                            disabled={isDeleting[project.id]}
                          >
                            <PlayCircle className="h-4 w-4 mr-2 text-green-600" />
                            Make Active
                          </DropdownMenuItem>
                        )}
                        
                        {project.status !== 'on_hold' && (
                          <DropdownMenuItem 
                            onClick={() => updateProjectStatus(project.id, 'on_hold')}
                            disabled={isDeleting[project.id]}
                          >
                            <PauseCircle className="h-4 w-4 mr-2 text-yellow-600" />
                            Put On Hold
                          </DropdownMenuItem>
                        )}
                        
                        {project.status !== 'completed' && (
                          <DropdownMenuItem 
                            onClick={() => updateProjectStatus(project.id, 'completed')}
                            disabled={isDeleting[project.id]}
                          >
                            <CheckCircle className="h-4 w-4 mr-2 text-blue-600" />
                            Mark Completed
                          </DropdownMenuItem>
                        )}
                        
                        {/* Duplicate project */}
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
                    <div className="mt-3">
                      <div className="text-xs font-medium text-gray-500 mb-1">Progress</div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-300",
                            project.status === 'completed' ? "bg-gray-400" : "bg-blue-600"
                          )}
                          style={{ width: `${project.progress || 0}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1 text-right">
                        {project.progress || 0}% Complete
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
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
      )}
    </div>
  );
};

export default OtherProjectsCard;