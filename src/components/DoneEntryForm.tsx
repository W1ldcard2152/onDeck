'use client'

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckSquare } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface DoneEntryFormProps {
  onEntryCreated?: (entry: any) => void;
}

export const DoneEntryForm: React.FC<DoneEntryFormProps> = ({ 
  onEntryCreated
}) => {
  const { user } = useSupabaseAuth();
  const supabase = createClientComponentClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !title.trim()) return;

    setIsSubmitting(true);

    try {
      // Create the item first
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .insert({
          user_id: user.id,
          title: title.trim(),
          item_type: 'task',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (itemError) throw itemError;

      // Create the task with completed status and today's assigned date
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          id: itemData.id,
          status: 'completed',
          description: description.trim() || null,
          priority: 'normal',
          assigned_date: todayString
        });

      if (taskError) throw taskError;

      // Reset form
      setTitle('');
      setDescription('');
      setOpen(false);
      
      // Notify parent
      if (onEntryCreated) {
        onEntryCreated(itemData);
      }
    } catch (error) {
      console.error('Error creating done entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          + Done
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Completed Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Name</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What did you complete?"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Notes (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any additional details..."
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !title.trim()}
            >
              {isSubmitting ? 'Adding...' : 'Add Done Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};