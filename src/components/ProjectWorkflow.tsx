import React, { useState } from 'react';
import { PlusCircle, GripVertical, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
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
  const supabase = createClientComponentClient<Database>();

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
    setIsSubmitting(true);

    try {
      // Create project entry
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert([{
          parent_task_id: parentTaskId || null,
          status: 'active',
          progress: 0,
        }])
        .select()
        .single();

      if (projectError) throw projectError;

      // Create initial task for the project
      const { error: taskError } = await supabase
        .from('tasks')
        .insert([{
          title: projectTitle,
          description: projectGoal,
          status: 'active',
          priority: 'normal',
        }])
        .select();

      if (taskError) throw taskError;

      if (onProjectCreated) {
        onProjectCreated();
      }

      // Reset form
      setProjectTitle('');
      setProjectGoal('');
      setSteps([{ title: '', description: '' }]);
      
    } catch (error) {
      console.error('Error creating project:', error);
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
              <Label htmlFor="projectGoal">Project Goal</Label>
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
            <h3 className="font-medium mb-2">Task Creation Preview</h3>
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