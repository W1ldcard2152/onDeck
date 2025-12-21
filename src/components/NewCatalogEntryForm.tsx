'use client'

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bookmark } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useCatalog } from '@/hooks/useCatalog';
import type { ResourceType } from '@/types/database.types';

interface NewCatalogEntryFormProps {
  onEntryCreated?: () => void;
  onClose?: () => void;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

export const NewCatalogEntryForm: React.FC<NewCatalogEntryFormProps> = ({
  onEntryCreated,
  onClose,
  open: controlledOpen,
  setOpen: controlledSetOpen
}) => {
  const { user } = useSupabaseAuth();
  const { createCatalogEntry } = useCatalog(user?.id);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledSetOpen || setInternalOpen;

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [resourceType, setResourceType] = useState<ResourceType>('website');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setUrl('');
    setTitle('');
    setDescription('');
    setResourceType('website');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    setOpen(false);
    if (onClose) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    // Basic URL validation
    try {
      new URL(url.trim());
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    if (!user) {
      setError('You must be logged in to add a catalog entry');
      return;
    }

    setIsSubmitting(true);

    try {
      await createCatalogEntry({
        url: url.trim(),
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        resource_type: resourceType,
      });

      if (onEntryCreated) {
        onEntryCreated();
      }

      handleClose();
      resetForm();
    } catch (err) {
      console.error('Error saving catalog entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to save catalog entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button>
            <Bookmark className="h-4 w-4 mr-2" />
            Capture URL
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Capture URL</DialogTitle>
          <DialogDescription>
            Save a website, video, or article for later reference.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="url">URL *</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              type="text"
              placeholder="e.g., React Documentation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resource_type">Type</Label>
            <Select value={resourceType} onValueChange={(value) => setResourceType(value as ResourceType)}>
              <SelectTrigger id="resource_type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="article">Article</SelectItem>
                <SelectItem value="documentation">Documentation</SelectItem>
                <SelectItem value="tutorial">Tutorial</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add notes about this resource..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Capture'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewCatalogEntryForm;
