'use client'

import React, { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Clock, MoreHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import ProjectWorkflow from '@/components/ProjectWorkflow';
import OtherProjectsCard from '@/components/OtherProjectsCard';
import { useProjects } from '@/hooks/useProjects';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectEntryForm } from '@/components/ProjectEntryForm';
import type { ProjectStep, ProjectWithDetails } from '@/lib/types';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import { ProjectTaskManager } from '@/lib/projectTaskManager';

interface ProjectCardProps {
  project: ProjectWithDetails;
  onProjectUpdate: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onProjectUpdate }) => {
  const [showSteps, setShowSteps] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithDetails | null>(null);
  const { user } = useSupabaseAuth();
  const supabase = createClientComponentClient();
  const [creatingTaskForStep, setCreatingTaskForStep] = useState<string | null>(null);
  const [taskCreationError, setTaskCreationError] = useState<string | null>(null);

  const steps = project.steps || [];
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const progress = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

  // Function to manually create a task for a step that doesn't have one yet
  const createTaskForStep = async (stepId: string) => {
    if (!user) return;
    setCreatingTaskForStep(stepId);
    setTaskCreationError(null);
    
    try {
      // Find the step
      const step = steps.find(s => s.id === stepId);
      if (!step) {
        throw new Error("Step not found");
      }
      
      // Check if step already has a task
      if (step.is_converted && step.converted_task_id) {
        throw new Error("This step already has an associated task");
      }
      
      // Check if previous steps are completed
      const stepIndex = steps.findIndex(s => s.id === stepId);
      const previousSteps = steps.slice(0, stepIndex);
      const hasIncompletePreviousSteps = previousSteps.some(s => s.status !== 'completed');
      
      if (hasIncompletePreviousSteps && !window.confirm(
        "Creating a task for this step while previous steps are incomplete " +
        "may cause workflow issues. Continue anyway?"
      )) {
        return;
      }
      
      const projectTaskManager = new ProjectTaskManager({ 
        supabase, 
        userId: user.id 
      });
      
      await projectTaskManager.createTaskForStep(step, project.id);
      
      // Update the UI
      onProjectUpdate();
    } catch (error: any) {
      console.error('Error creating task for step:', error);
      setTaskCreationError(
        error instanceof Error ? error.message : "Failed to create task"
      );
    } finally {
      setCreatingTaskForStep(null);
    }
  };

  // Render status badge for steps
  const renderStepStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
    }
  };

  // Sync all project steps with tasks
  const syncProjectWithTasks = async () => {
    if (!user) return;
    
    try {
      const projectTaskManager = new ProjectTaskManager({ 
        supabase, 
        userId: user.id 
      });
      
      await projectTaskManager.syncProjectSteps(project.id);
      onProjectUpdate();
    } catch (error) {
      console.error('Error syncing project with tasks:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-medium">{project.title}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {project.description || 'No description'}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="text-sm text-gray-500">
              {progress}% Complete
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setProjectToEdit(project)}>
                  Edit Project
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowSteps(!showSteps)}>
                  {showSteps ? 'Hide Steps' : 'Show Steps'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={syncProjectWithTasks}>
                  Sync with Tasks
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {taskCreationError && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{taskCreationError}</AlertDescription>
          </Alert>
        )}

        {/* Steps Section */}
        {showSteps && (
          <div className="mt-4 space-y-3 border-t pt-4">
            {steps.length > 0 ? (
              steps.map((step, index) => {
                const isLoading = creatingTaskForStep === step.id;
                
                return (
                  <div key={step.id} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50">
                    <StepIcon status={step.status} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{step.title}</div>
                        {renderStepStatusBadge(step.status)}
                      </div>
                      
                      {step.description && (
                        <p className="text-sm text-gray-500 mt-1">{step.description}</p>
                      )}
                      
                      <div className="flex items-center mt-2 text-xs text-gray-500 space-x-4">
                        {step.assigned_date && (
                          <span>Assigned: {format(new Date(step.assigned_date), 'MMM d, yyyy')}</span>
                        )}
                        {step.due_date && (
                          <span>Due: {format(new Date(step.due_date), 'MMM d, yyyy')}</span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      {!step.is_converted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => createTaskForStep(step.id)}
                          disabled={isLoading}
                          className="text-xs"
                        >
                          {isLoading ? "Creating..." : "Create Task"}
                        </Button>
                      ) : (
                        <Button
                          variant="link"
                          size="sm"
                          className="text-blue-600 text-xs"
                          onClick={() => {
                            // Navigate to tasks view with this task highlighted
                            // router.push(`/tasks?id=${step.converted_task_id}`);
                          }}
                        >
                          View Task
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-gray-500 text-center py-2">
                No steps defined
              </div>
            )}
          </div>
        )}
      </div>

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

const StepIcon = ({ status }: { status: ProjectStep['status'] }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />;
    case 'in_progress':
      return <Clock className="w-5 h-5 text-blue-500 mt-0.5" />;
    default:
      return <Circle className="w-5 h-5 text-gray-400 mt-0.5" />;
  }
};

const ProjectsPage = () => {
  const { user } = useSupabaseAuth();
  const { projects, isLoading, refetch } = useProjects(user?.id);

  // Filter projects by status
  const activeProjects = projects.filter(p => p.status === 'active');
  const onHoldProjects = projects.filter(p => p.status === 'on_hold');
  const completedProjects = projects.filter(p => p.status === 'completed');
  
  const upcomingSteps: ProjectStep[] = projects
    .flatMap(p => p.steps || [])
    .filter(step => step.status === 'pending')
    .sort((a, b) => a.order_number - b.order_number)
    .slice(0, 5);

  const renderActiveProjects = () => {
    if (isLoading) {
      return <div className="text-center py-8">Loading projects...</div>;
    }

    if (activeProjects.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No active projects yet
        </div>
      );
    }

    return (
      <div>
        {activeProjects.map(project => (
          <ProjectCard 
            key={project.id} 
            project={project}
            onProjectUpdate={refetch}
          />
        ))}
      </div>
    );
  };

  const renderUpcomingSteps = () => {
    if (isLoading) {
      return <div className="text-center py-4">Loading steps...</div>;
    }

    if (upcomingSteps.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500">
          No upcoming steps
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {upcomingSteps.map(step => (
          <div key={step.id} className="flex items-start gap-3">
            <StepIcon status={step.status} />
            <div>
              <div className="font-medium">{step.title}</div>
              {step.description && (
                <p className="text-sm text-gray-500 mt-1">{step.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <ProjectWorkflow onProjectCreated={refetch} />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium mb-4">Active Projects</h2>
        {renderActiveProjects()}
      </div>

      {upcomingSteps.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-4">Upcoming Steps</h2>
          {renderUpcomingSteps()}
        </div>
      )}

      {/* Always show the Other Projects card, even if empty */}
      <OtherProjectsCard
        onHoldProjects={onHoldProjects}
        completedProjects={completedProjects}
        onProjectUpdate={refetch}
      />
    </div>
  );
};

export default ProjectsPage;