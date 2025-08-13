'use client'

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useKeystones } from '@/hooks/useKeystones';
import type { Keystone } from '@/lib/types';

interface KeystoneFormProps {
  onKeystoneCreated?: () => void;
  initialData?: Keystone;
  isEditing?: boolean;
  onClose?: () => void;
}

const colorOptions = [
  { value: '#3B82F6', label: 'Blue', className: 'bg-blue-500' },
  { value: '#10B981', label: 'Green', className: 'bg-green-500' },
  { value: '#F59E0B', label: 'Yellow', className: 'bg-yellow-500' },
  { value: '#EF4444', label: 'Red', className: 'bg-red-500' },
  { value: '#8B5CF6', label: 'Purple', className: 'bg-purple-500' },
  { value: '#EC4899', label: 'Pink', className: 'bg-pink-500' },
  { value: '#14B8A6', label: 'Teal', className: 'bg-teal-500' },
  { value: '#F97316', label: 'Orange', className: 'bg-orange-500' },
];

export const KeystoneForm: React.FC<KeystoneFormProps> = ({ 
  onKeystoneCreated, 
  initialData,
  isEditing = false,
  onClose 
}) => {
  const { user } = useSupabaseAuth();
  const { createKeystone, updateKeystone } = useKeystones(user?.id);
  const [open, setOpen] = useState(isEditing);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with data when editing
  useEffect(() => {
    if (initialData && isEditing) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setColor(initialData.color || '#3B82F6');
    }
  }, [initialData, isEditing]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setColor('#3B82F6');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!user) {
      setError('You must be logged in to create keystones');
      setIsSubmitting(false);
      return;
    }

    try {
      if (isEditing && initialData) {
        await updateKeystone(initialData.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          color
        });
      } else {
        await createKeystone({
          name: name.trim(),
          description: description.trim() || undefined,
          color
        });
      }

      setOpen(false);
      resetForm();
      if (onKeystoneCreated) {
        onKeystoneCreated();
      }
      if (onClose) onClose();
    } catch (err) {
      console.error('Error saving keystone:', err);
      setError(err instanceof Error ? err.message : 'Failed to save keystone');
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
            New Keystone
          </Button>
        ) : null}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Keystone' : 'Create New Keystone'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update keystone details.' : 'Create a new keystone to organize your knowledge bases.'}
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
              placeholder="Enter keystone name"
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
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((colorOption) => (
                <button
                  key={colorOption.value}
                  type="button"
                  onClick={() => setColor(colorOption.value)}
                  className={`w-8 h-8 rounded-full ${colorOption.className} ${
                    color === colorOption.value ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                  }`}
                  title={colorOption.label}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Keystone")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};