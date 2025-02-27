'use client'

import React, { useState } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { ProjectEntryForm } from '@/components/ProjectEntryForm';
import ActiveProjectsCard from '@/components/ActiveProjectsCard';
import OtherProjectsCard from '@/components/OtherProjectsCard';

export default function ProjectsPage() {
  const { user } = useSupabaseAuth();
  const { projects, isLoading, error, refetch } = useProjects(user?.id);
  const [refreshKey, setRefreshKey] = useState(0);

  // Trigger a refresh when needed
  const handleProjectUpdate = () => {
    refetch();
    setRefreshKey(prev => prev + 1);
  };

  // Filter projects by status
  const activeProjects = projects.filter(project => project.status === 'active');
  const onHoldProjects = projects.filter(project => project.status === 'on_hold');
  const completedProjects = projects.filter(project => project.status === 'completed');

  if (isLoading) {
    return (
      <div className="py-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-center items-center h-32">
            <div className="text-lg text-gray-500">Loading projects...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-red-500 text-center">
            Error loading projects: {error.message}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Projects</h1>
        <ProjectEntryForm onProjectCreated={handleProjectUpdate} />
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Active Projects</h2>
        <ActiveProjectsCard 
          activeProjects={activeProjects} 
          onProjectUpdate={handleProjectUpdate} 
          key={`active-${refreshKey}`}
        />
      </div>

      <OtherProjectsCard 
        onHoldProjects={onHoldProjects} 
        completedProjects={completedProjects} 
        onProjectUpdate={handleProjectUpdate}
        key={`other-${refreshKey}`}
      />
    </div>
  );
}