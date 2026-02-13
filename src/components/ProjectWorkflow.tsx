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
  onProjectCreated?: () => void;
}

const ProjectWorkflow: React.FC<ProjectWorkflowProps> = ({ onProjectCreated }) => {
  const { user } = useSupabaseAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClientComponentClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      
      // First create the item
      const { data: item, error: itemError } = await supabase
        .from('items')
        .insert([{
          title: title.trim(),
          user_id: user.id,
          item_type: 'project',
          created_at: now,
          updated_at: now,
          is_archived: false
        }])
        .select()
        .single();

      if (itemError) throw itemError;

      // Then create the project
      const { error: projectError } = await supabase
        .from('projects')
        .insert([{
          id: item.id,
          status: 'active',
          progress: 0,
          description: description.trim() || null,
          current_step: 0,
          user_id: user.id
        }]);

      if (projectError) throw projectError;

      if (onProjectCreated) {
        onProjectCreated();
      }

      // Reset form
      setTitle('');
      setDescription('');
      
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
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter project title"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="description">Project Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's the final outcome you want to achieve?"
                className="h-24"
              />
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