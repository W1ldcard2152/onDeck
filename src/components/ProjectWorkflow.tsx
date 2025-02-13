import React, { useState } from 'react';
import { PlusCircle, GripVertical, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import type { Database } from '@/types/database.types';

interface ProjectWorkflowProps {
  parentTaskId?: string;
  onProjectCreated?: () => void;
}

const ProjectWorkflow: React.FC<ProjectWorkflowProps> = ({ 
  parentTaskId,
  onProjectCreated 
}) => {
  const [steps, setSteps] = useState([{ title: '', description: '' }]);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectGoal, setProjectGoal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient<Database>();
  const { user } = useSupabaseAuth();

  const addStep = () => {
    setSteps([...steps, { title: '', description: '' }]);
  };

  const updateStep = (index: number, field: 'title' | 'description', value: string) => {
    const newSteps = [...steps];
    newSteps[index][field] = value;
    setSteps(newSteps);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to create a project');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const now = new Date().toISOString();

      // First create an item for the project
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .insert([{
          title: projectTitle.trim(),
          user_id: user.id,
          item_type: 'project',
          created_at: now,
          updated_at: now,
          is_archived: false
        }])
        .select()
        .single();

      if (itemError) {
        console.error('Item creation error:', itemError);
        throw itemError;
      }

      if (!itemData) {
        throw new Error('Failed to create item');
      }

      // Create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert([{
          id: itemData.id,
          title: projectTitle.trim(),
          description: projectGoal.trim(),
          status: 'active',
          progress: 0,
          user_id: user.id,
          parent_task_id: parentTaskId || null,
          current_step: 1,
          created_at: now,
          updated_at: now,
          priority: 'normal',
          completed_at: null,
          estimated_completion_date: null
        }])
        .select()
        .single();

      if (projectError) {
        console.error('Project creation error:', projectError);
        throw projectError;
      }

      // Create only the first task
      if (steps.length > 0) {
        const firstStep = steps[0];
        
        // Create item for the first task
        const { data: taskItem, error: taskItemError } = await supabase
          .from('items')
          .insert([{
            title: firstStep.title.trim(),
            user_id: user.id,
            item_type: 'task',
            created_at: now,
            updated_at: now,
            is_archived: false
          }])
          .select()
          .single();

        if (taskItemError) {
          console.error('Task item creation error:', taskItemError);
          throw taskItemError;
        }

        // Create the first task
        const { error: taskError } = await supabase
          .from('tasks')
          .insert([{
            id: taskItem.id,
            status: 'on_deck',
            description: firstStep.description.trim(),
            is_project_converted: false,
            converted_project_id: itemData.id,
            priority: 'normal'
          }]);

        if (taskError) {
          console.error('Task creation error:', taskError);
          throw taskError;
        }

        // Store subsequent steps metadata
        const { error: metadataError } = await supabase
          .from('project_metadata')
          .insert([{
            project_id: itemData.id,
            pending_steps: steps.slice(1).map((step, index) => ({
              title: step.title.trim(),
              description: step.description.trim(),
              sequence: index + 2  // Start from 2 since step 1 is already created
            }))
          }]);

        if (metadataError) {
          console.error('Metadata storage error:', metadataError);
          // Continue even if metadata storage fails
        }
      }

      if (onProjectCreated) {
        onProjectCreated();
      }

      // Reset form
      setProjectTitle('');
      setProjectGoal('');
      setSteps([{ title: '', description: '' }]);
      
    } catch (error) {
      console.error('Error creating project:', error);
      setError(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 text-white">
          <PlusCircle className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}

          {/* Project Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="projectTitle">Project Title</Label>
              <Input
                id="projectTitle"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="Enter project title"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="projectGoal">Project Description</Label>
              <Textarea
                id="projectGoal"
                value={projectGoal}
                onChange={(e) => setProjectGoal(e.target.value)}
                placeholder="What's the final outcome you want to achieve?"
                className="h-24"
              />
            </div>
          </div>

          {/* Project Steps */}
          <div>
            <Label>Project Steps</Label>
            <div className="mt-2 space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="flex gap-4 items-start bg-gray-50 p-4 rounded-lg">
                  <GripVertical className="w-5 h-5 mt-2 text-gray-400" />
                  
                  <div className="flex-1 space-y-3">
                    <Input
                      value={step.title}
                      onChange={(e) => updateStep(index, 'title', e.target.value)}
                      placeholder={`Step ${index + 1} title`}
                      required
                    />
                    <Textarea
                      value={step.description}
                      onChange={(e) => updateStep(index, 'description', e.target.value)}
                      placeholder="Step description"
                      className="h-20"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={addStep}
              className="mt-4"
            >
              Add Step
            </Button>
          </div>

          {/* Preview */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium mb-2">Project Structure Preview</h3>
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                    {index + 1}
                  </div>
                  <ArrowRight className="w-4 h-4" />
                  <div className="flex-1">
                    {step.title || `Step ${index + 1}`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-blue-600"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating Project...' : 'Create Project'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectWorkflow;