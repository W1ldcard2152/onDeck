import React, { useState } from 'react';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, MoreHorizontal } from 'lucide-react';
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
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setProjectToEdit(project)}>
                          Edit Project
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