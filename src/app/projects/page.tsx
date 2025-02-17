'use client'

import React, { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Clock, MoreHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import ProjectWorkflow from '@/components/ProjectWorkflow';
import { DashboardCard } from '@/components/DashboardCard';
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

interface ProjectCardProps {
  project: ProjectWithDetails;
  onProjectUpdate: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onProjectUpdate }) => {
  const [showSteps, setShowSteps] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithDetails | null>(null);

  const steps = project.steps || [];
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const progress = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

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

        {/* Steps Section */}
        {showSteps && (
          <div className="mt-4 space-y-3 border-t pt-4">
            {steps.length > 0 ? (
              steps.map(step => (
                <div key={step.id} className="flex items-start gap-3">
                  <StepIcon status={step.status} />
                  <div className="flex-1">
                    <div className="font-medium">{step.title}</div>
                    {step.description && (
                      <p className="text-sm text-gray-500 mt-1">{step.description}</p>
                    )}
                  </div>
                </div>
              ))
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

  const activeProjects = projects.filter(p => p.status === 'active');
  
  const upcomingSteps: ProjectStep[] = projects
  .flatMap(p => p.steps || [])
  .filter(step => step.status === 'pending')
  .sort((a, b) => a.order_number - b.order_number)  // Changed from order
  .slice(0, 5);

  const recentActivity = projects
    .filter(p => p.updated_at)
    .sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
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
      <div className="space-y-4">
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
      return <div className="text-center py-8">Loading steps...</div>;
    }

    if (upcomingSteps.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
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

  const renderRecentActivity = () => {
    if (isLoading) {
      return <div className="text-center py-8">Loading activity...</div>;
    }

    if (recentActivity.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No recent activity
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {recentActivity.map(project => (
          <div key={project.id} className="flex items-start gap-3">
            <div className="flex-1">
              <div className="font-medium">{project.title}</div>
              <div className="text-sm text-gray-500 mt-1">
                Updated {format(new Date(project.updated_at), 'MMM d, yyyy')}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <ProjectWorkflow onProjectCreated={refetch} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Active Projects"
          content={renderActiveProjects()}
        />
        
        <DashboardCard
          title="Upcoming Steps"
          content={renderUpcomingSteps()}
        />

        <DashboardCard
          title="Recent Activity"
          content={renderRecentActivity()}
        />
      </div>
    </div>
  );
};

export default ProjectsPage;