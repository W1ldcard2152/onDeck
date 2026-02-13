'use client'

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { EntryService } from '@/lib/entryService';
import type { QuoteWithDetails } from '@/lib/types';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database.types';

interface NewQuoteFormProps {
  onQuoteCreated?: () => void;
  initialData?: QuoteWithDetails;
  isEditing?: boolean;
  onClose?: () => void;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

export const NewQuoteForm: React.FC<NewQuoteFormProps> = ({
  onQuoteCreated,
  initialData,
  isEditing = false,
  onClose,
  open: controlledOpen,
  setOpen: controlledSetOpen
}) => {
  const { user } = useSupabaseAuth();
  const supabase = createClientComponentClient();

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledSetOpen || setInternalOpen;

  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [source, setSource] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing && initialData) {
      setContent(initialData.content || '');
      setAuthor(initialData.author || '');
      setSource(initialData.source || '');
    }
  }, [isEditing, initialData]);

  const resetForm = () => {
    setContent('');
    setAuthor('');
    setSource('');
    setError(null);
  };

  const handleClose = () => {
    if (!isEditing) {
      resetForm();
    }
    setOpen(false);
    if (onClose) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError('Quote content is required');
      return;
    }

    if (!user) {
      setError('You must be logged in to add a quote');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && initialData) {
        // Update existing quote
        const now = new Date().toISOString();

        const { error: quoteError } = await supabase
          .from('quotes')
          .update({
            content: content.trim(),
            author: author.trim() || null,
            source: source.trim() || null,
            updated_at: now
          })
          .eq('id', initialData.id);

        if (quoteError) throw quoteError;

        const { error: itemError } = await supabase
          .from('items')
          .update({
            title: content.trim().substring(0, 100), // Use first 100 chars as title
            updated_at: now
          })
          .eq('id', initialData.id);

        if (itemError) throw itemError;
      } else {
        // Create new quote
        await EntryService.createEntry({
          title: content.trim().substring(0, 100), // Use first 100 chars as title
          type: 'quote',
          user_id: user.id,
          content: content.trim(),
          author: author.trim() || null,
          source: source.trim() || null
        });
      }

      if (onQuoteCreated) {
        onQuoteCreated();
      }

      handleClose();
      resetForm();
    } catch (err) {
      console.error('Error saving quote:', err);
      setError(err instanceof Error ? err.message : 'Failed to save quote');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEditing && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Quote
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Quote' : 'Add New Quote'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the quote details below.' : 'Add a new quote to your collection.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="content">Quote *</Label>
            <Textarea
              id="content"
              placeholder="Enter the quote..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              required
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="author">Author</Label>
            <Input
              id="author"
              type="text"
              placeholder="e.g., Marcus Aurelius"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Input
              id="source"
              type="text"
              placeholder="e.g., Meditations, Book IV"
              value={source}
              onChange={(e) => setSource(e.target.value)}
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
              {isSubmitting ? 'Saving...' : (isEditing ? 'Update Quote' : 'Add Quote')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewQuoteForm;
