'use client'

import React from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import ProjectWorkflow from '@/components/ProjectWorkflow';
import { DashboardCard } from '@/components/DashboardCard';
import { useProjects } from '@/hooks/useProjects';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import type { ProjectStep } from '@/lib/types';

const ProjectsPage = () => {
  const { user } = useSupabaseAuth();
  const { projects, isLoading } = useProjects(user?.id);

  const activeProjects = projects.filter(p => p.status === 'active');
  
  // Handle the case where steps might not exist
  const upcomingSteps: ProjectStep[] = projects
    .flatMap(p => p.steps || [])
    .filter(step => step.status === 'pending')
    .sort((a, b) => a.order - b.order)
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
          <div key={project.id} className="p-4 bg-white rounded-lg border">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{project.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {project.description || 'No description'}
                </p>
              </div>
              <div className="text-sm text-gray-500">
                {project.progress}% Complete
              </div>
            </div>
          </div>
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
        <ProjectWorkflow />
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