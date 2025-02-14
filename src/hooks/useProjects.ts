import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database.types';
import type { ProjectWithDetails, Task } from '@/lib/types';

export function useProjects(userId: string | undefined) {
  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  async function fetchProjects() {
    if (!userId) {
      setProjects([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const supabase = createClientComponentClient<Database>();

      // Get all projects for the user
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          *,
          items!inner (
            id,
            user_id,
            title,
            created_at,
            updated_at,
            item_type,
            is_archived,
            archived_at,
            archive_reason
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;
      if (!projectsData?.length) {
        setProjects([]);
        return;
      }

      // Get associated tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .in('project_id', projectsData.map(p => p.id));

      if (tasksError) throw tasksError;

      // Transform the data to match our ProjectWithDetails type
      const transformedProjects: ProjectWithDetails[] = projectsData.map(project => {
        const projectTasks: Task[] = tasksData
          ?.filter(task => task.project_id === project.id)
          .map(task => ({
            id: task.id,
            description: task.description,
            status: task.status || 'on_deck',
            due_date: task.due_date,
            priority: task.priority || null,
            assigned_date: task.assigned_date,
            project_id: task.project_id?.toString() || null,
            is_project_converted: task.is_project_converted || false,
            converted_project_id: task.converted_project_id || null
          })) || [];

        return {
          id: project.id,
          title: project.title || '',
          description: project.description || null,
          status: project.status || 'active',
          progress: project.progress || 0,
          created_at: project.created_at,
          updated_at: project.updated_at,
          completed_at: project.completed_at || null,
          current_step: project.current_step || 0,
          estimated_completion_date: project.estimated_completion_date || null,
          priority: project.priority || null,
          parent_task_id: project.parent_task_id || null,
          user_id: project.user_id,
          tasks: projectTasks,
          steps: [], // Since we don't have a steps table yet
          item: {
            id: project.items.id,
            user_id: project.items.user_id,
            title: project.items.title,
            created_at: project.items.created_at,
            updated_at: project.items.updated_at,
            item_type: project.items.item_type,
            is_archived: project.items.is_archived,
            archived_at: project.items.archived_at,
            archive_reason: project.items.archive_reason
          }
        };
      });

      setProjects(transformedProjects);
    } catch (e) {
      console.error('Error in fetchProjects:', e);
      setError(e instanceof Error ? e : new Error('An error occurred while fetching projects'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects();
  }, [userId]);

  return { projects, isLoading, error, refetch: fetchProjects };
}