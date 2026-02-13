'use client'

import React, { useState } from 'react';
import type { TaskWithDetails } from '@/lib/types';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

interface TasksDebuggerProps {
  tasks: TaskWithDetails[];
}

export const TasksDebugger: React.FC<TasksDebuggerProps> = ({ tasks }) => {
  if (process.env.NODE_ENV !== 'development') return null;

  const [projectInfo, setProjectInfo] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const projectTasks = tasks.filter(task => task.project_id);
  const projectIds = [...new Set(projectTasks.map(task => task.project_id))];
  
  const fetchProjectInfo = async () => {
    setIsLoading(true);
    try {
      const supabase = createClientComponentClient();
      
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds);
        
      if (projectsError) throw projectsError;
      
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .in('id', projectIds);
        
      if (itemsError) throw itemsError;
      
      const { data: steps, error: stepsError } = await supabase
        .from('project_steps')
        .select('*')
        .in('project_id', projectIds);
        
      if (stepsError) throw stepsError;
      
      // Combine data
      const info: Record<string, any> = {};
      projectIds.forEach(id => {
        if (!id) return;
        const project = projects?.find(p => p.id === id);
        const item = items?.find(i => i.id === id);
        const projectSteps = steps?.filter(s => s.project_id === id) || [];
        
        info[id] = {
          project,
          item,
          steps: projectSteps,
          linkedTasks: projectTasks.filter(t => t.project_id === id)
        };
      });
      
      setProjectInfo(info);
    } catch (err) {
      console.error('Error fetching project info:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="mt-8 border p-4 rounded-lg bg-gray-50">
      <h2 className="text-lg font-semibold mb-4">Project Tasks Debug Info</h2>
      
      <div className="mb-4">
        <div>Total tasks: {tasks.length}</div>
        <div>Tasks with project links: {projectTasks.length}</div>
        <div>Unique projects: {projectIds.length}</div>
      </div>
      
      <Button 
        onClick={fetchProjectInfo} 
        disabled={isLoading}
        className="mb-4"
      >
        {isLoading ? 'Loading...' : 'Fetch Project Info'}
      </Button>
      
      {Object.keys(projectInfo).length > 0 && (
        <Accordion type="single" collapsible>
          {Object.entries(projectInfo).map(([projectId, info]) => (
            <AccordionItem key={projectId} value={projectId}>
              <AccordionTrigger>
                Project: {info.item?.title || projectId}
              </AccordionTrigger>
              <AccordionContent>
                <div className="text-sm space-y-2">
                  <div>
                    <div className="font-medium">Project Status: {info.project?.status}</div>
                    <div>Description: {info.project?.description || 'None'}</div>
                  </div>
                  
                  <div>
                    <div className="font-medium mt-2">Steps ({info.steps?.length || 0}):</div>
                    <ul className="list-disc pl-5">
                      {info.steps?.map((step: any) => (
                        <li key={step.id}>
                          {step.title} ({step.status}) 
                          {step.is_converted && step.converted_task_id && (
                            <span className="text-blue-600"> → Task linked</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <div className="font-medium mt-2">Tasks ({info.linkedTasks?.length || 0}):</div>
                    <ul className="list-disc pl-5">
                      {info.linkedTasks?.map((task: TaskWithDetails) => (
                        <li key={task.id}>
                          {task.item.title} ({task.status})
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};

export default TasksDebugger;