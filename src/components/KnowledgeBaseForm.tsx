'use client'

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useKnowledgeBases } from '@/hooks/useKnowledgeBases';
import type { KnowledgeBase, Keystone } from '@/lib/types';

interface KnowledgeBaseFormProps {
  keystones: Keystone[];
  onKBCreated?: () => void;
  initialData?: KnowledgeBase;
  isEditing?: boolean;
  onClose?: () => void;
}

export const KnowledgeBaseForm: React.FC<KnowledgeBaseFormProps> = ({ 
  keystones,
  onKBCreated, 
  initialData,
  isEditing = false,
  onClose 
}) => {
  const { user } = useSupabaseAuth();
  const { createKnowledgeBase, updateKnowledgeBase } = useKnowledgeBases(user?.id);
  const [open, setOpen] = useState(isEditing);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keystoneId, setKeystoneId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with data when editing
  useEffect(() => {
    if (initialData && isEditing) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setKeystoneId(initialData.keystone_id || 'none');
    }
  }, [initialData, isEditing]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setKeystoneId('none');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!user) {
      setError('You must be logged in to create knowledge bases');
      setIsSubmitting(false);
      return;
    }

    try {
      if (isEditing && initialData) {
        await updateKnowledgeBase(initialData.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          keystone_id: keystoneId === 'none' ? undefined : keystoneId || undefined
        });
      } else {
        await createKnowledgeBase({
          name: name.trim(),
          description: description.trim() || undefined,
          keystone_id: keystoneId === 'none' ? undefined : keystoneId || undefined
        });
      }

      setOpen(false);
      resetForm();
      if (onKBCreated) {
        onKBCreated();
      }
      if (onClose) onClose();
    } catch (err) {
      console.error('Error saving knowledge base:', err);
      setError(err instanceof Error ? err.message : 'Failed to save knowledge base');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
          resetForm();
          if (onClose) onClose();
        }
      }}
    >
      <DialogTrigger asChild>
        {!isEditing ? (
          <Button className="bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            New Knowledge Base
          </Button>
        ) : null}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Knowledge Base' : 'Create New Knowledge Base'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update knowledge base details.' : 'Create a new knowledge base to organize your entries.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter knowledge base name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description (optional)"
              className="h-20 min-h-[5rem]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="keystone">Keystone</Label>
            <Select
              value={keystoneId}
              onValueChange={setKeystoneId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a keystone (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No keystone</SelectItem>
                {keystones.map((keystone) => (
                  <SelectItem key={keystone.id} value={keystone.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: keystone.color }}
                      />
                      {keystone.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Knowledge Base")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};