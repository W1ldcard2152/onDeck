import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import ProjectWorkflow from '@/components/ProjectWorkflow';
import { DashboardCard } from '@/components/DashboardCard';
import { format } from 'date-fns';
import type { Database } from '@/types/database.types';

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  current_step: number;
  created_at: string;
  updated_at: string;
}

interface TaskItem {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  converted_project_id: string | null;
}

interface ActivityEvent {
  id: string;
  project_title: string;
  action: string;
  timestamp: string;
}

const ProjectsPage = () => {
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [upcomingSteps, setUpcomingSteps] = useState<TaskItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useSupabaseAuth();
  const supabase = createClientComponentClient<Database>();

  const fetchProjectData = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch active projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select()
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;
      setActiveProjects(projects || []);

      // Fetch upcoming steps (tasks) with their item titles
      const { data: taskData, error: tasksError } = await supabase
        .from('items')
        .select(`
          id,
          title,
          tasks!inner (
            id,
            description,
            status,
            converted_project_id
          )
        `)
        .eq('item_type', 'task')
        .eq('tasks.status', 'on_deck')
        .order('created_at', { ascending: true })
        .limit(5);

      if (tasksError) throw tasksError;

      // Transform task data into the format we need
      const formattedTasks = (taskData || []).map(item => ({
        id: item.id,
        title: item.title,
        description: item.tasks?.[0]?.description || null,
        status: item.tasks?.[0]?.status || 'on_deck',
        converted_project_id: item.tasks?.[0]?.converted_project_id || null
      }));

      setUpcomingSteps(formattedTasks);

      // Fetch recent activity
      const { data: activity, error: activityError } = await supabase
        .from('items')
        .select(`
          id,
          title,
          updated_at
        `)
        .eq('user_id', user.id)
        .eq('item_type', 'project')
        .order('updated_at', { ascending: false })
        .limit(5);

      if (activityError) throw activityError;
      
      const formattedActivity = (activity || []).map(item => ({
        id: item.id,
        project_title: item.title || 'Untitled Project',
        action: 'updated',
        timestamp: item.updated_at
      }));

      setRecentActivity(formattedActivity);

    } catch (error) {
      console.error('Error fetching project data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch project data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [user]);

  const renderActiveProjects = () => {
    if (error) {
      return <div className="text-center py-8 text-red-500">{error}</div>;
    }

    if (isLoading) {
      return <div className="text-center py-8">Loading projects...</div>;
    }

    if (activeProjects.length === 0) {
      return <div className="text-center py-8 text-gray-500">No active projects yet</div>;
    }

    return (
      <div className="space-y-4">
        {activeProjects.map(project => (
          <div
            key={project.id}
            className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{project.title}</h3>
                {project.description && (
                  <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {format(new Date(project.created_at), 'MMM d, yyyy')}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="text-sm text-gray-600">
                Progress: {project.progress}%
              </div>
              <div className="text-sm text-gray-600">
                Step {project.current_step}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderUpcomingSteps = () => {
    if (error) {
      return <div className="text-center py-8 text-red-500">{error}</div>;
    }

    if (isLoading) {
      return <div className="text-center py-8">Loading steps...</div>;
    }

    if (upcomingSteps.length === 0) {
      return <div className="text-center py-8 text-gray-500">No upcoming steps</div>;
    }

    return (
      <div className="space-y-3">
        {upcomingSteps.map(step => (
          <div
            key={step.id}
            className="p-3 bg-white rounded-lg shadow-sm border border-gray-100"
          >
            <h4 className="font-medium">{step.title}</h4>
            {step.description && (
              <p className="text-sm text-gray-600 mt-1">{step.description}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderRecentActivity = () => {
    if (error) {
      return <div className="text-center py-8 text-red-500">{error}</div>;
    }

    if (isLoading) {
      return <div className="text-center py-8">Loading activity...</div>;
    }

    if (recentActivity.length === 0) {
      return <div className="text-center py-8 text-gray-500">No recent activity</div>;
    }

    return (
      <div className="space-y-3">
        {recentActivity.map(activity => (
          <div
            key={activity.id}
            className="p-3 bg-white rounded-lg shadow-sm border border-gray-100"
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium">{activity.project_title}</h4>
                <p className="text-sm text-gray-600">
                  Project {activity.action}
                </p>
              </div>
              <div className="text-sm text-gray-500">
                {format(new Date(activity.timestamp), 'MMM d, HH:mm')}
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
        <ProjectWorkflow onProjectCreated={fetchProjectData} />
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