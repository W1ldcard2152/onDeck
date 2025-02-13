import React from 'react';
import ProjectWorkflow from '@/components/ProjectWorkflow';
import { DashboardCard } from '@/components/DashboardCard';

const ProjectsPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <ProjectWorkflow />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Active Projects"
          content={
            <div className="text-center py-8 text-gray-500">
              No active projects yet
            </div>
          }
        />
        
        <DashboardCard
          title="Upcoming Steps"
          content={
            <div className="text-center py-8 text-gray-500">
              No upcoming steps
            </div>
          }
        />

        <DashboardCard
          title="Recent Activity"
          content={
            <div className="text-center py-8 text-gray-500">
              No recent activity
            </div>
          }
        />
      </div>
    </div>
  );
};

export default ProjectsPage;