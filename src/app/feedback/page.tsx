'use client'

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import AuthUI from '@/components/Auth';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit2, Trash2, Archive, ArchiveRestore, Plus } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase-client';
import { Database } from '@/types/database.types';

type FeedbackItem = Database['public']['Tables']['feedback']['Row'];

export default function FeedbackPage() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<FeedbackItem[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<FeedbackItem | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [newFeedback, setNewFeedback] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  const fetchFeedback = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: activeFeedback, error: activeError } = await supabase
        .from('feedback')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      const { data: archivedFeedback, error: archivedError } = await supabase
        .from('feedback')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', true)
        .order('archived_at', { ascending: false });

      if (activeError) throw activeError;
      if (archivedError) throw archivedError;

      setFeedbackItems(activeFeedback || []);
      setArchivedItems(archivedFeedback || []);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  const handleEdit = async (item: FeedbackItem) => {
    if (!editMessage.trim()) return;

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('feedback')
        // @ts-ignore - Supabase type inference issue
        .update({ message: editMessage.trim() })
        .eq('id', item.id);

      if (error) throw error;

      setEditingItem(null);
      setEditMessage('');
      fetchFeedback();
    } catch (error) {
      console.error('Error updating feedback:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id);

      if (error) throw error;

      fetchFeedback();
    } catch (error) {
      console.error('Error deleting feedback:', error);
    }
  };

  const handleArchive = async (id: string, isArchived: boolean) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('feedback')
        // @ts-ignore - Supabase type inference issue
        .update({
          is_archived: !isArchived,
          archived_at: !isArchived ? new Date().toISOString() : null
        })
        .eq('id', id);

      if (error) throw error;

      fetchFeedback();
    } catch (error) {
      console.error('Error archiving feedback:', error);
    }
  };

  const handleAddNew = async () => {
    if (!newFeedback.trim()) return;

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('feedback')
        // @ts-ignore - Supabase type inference issue
        .insert({
          user_id: user.id,
          message: newFeedback.trim()
        });

      if (error) throw error;

      setNewFeedback('');
      setIsAddingNew(false);
      fetchFeedback();
    } catch (error) {
      console.error('Error adding feedback:', error);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthUI />;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feedback</h1>
          <p className="text-muted-foreground">
            Share your thoughts, suggestions, or report issues
          </p>
        </div>
        <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
          <DialogTrigger asChild>
            <Button className="bg-orange-300 hover:bg-orange-400">
              <Plus className="h-4 w-4 mr-2" />
              New Feedback
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Feedback</DialogTitle>
              <DialogDescription>
                Share your thoughts, suggestions, or report issues.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Enter your feedback here..."
              value={newFeedback}
              onChange={(e) => setNewFeedback(e.target.value)}
              className="min-h-[120px]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddingNew(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddNew} disabled={!newFeedback.trim()} className="bg-orange-300 hover:bg-orange-400">
                Submit Feedback
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowArchived(false)}
          className={`px-4 py-2 rounded-lg ${
            !showArchived
              ? 'bg-orange-300 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setShowArchived(true)}
          className={`px-4 py-2 rounded-lg ${
            showArchived
              ? 'bg-orange-300 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Archived
        </button>
      </div>

      {/* Feedback Cards */}
      <div className="bg-white rounded-lg shadow">
        {(showArchived ? archivedItems : feedbackItems).length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {showArchived
              ? 'No archived feedback items yet.'
              : 'No active feedback items. Click "New Feedback" to create one.'
            }
          </div>
        ) : (
          <div className="divide-y">
            {(showArchived ? archivedItems : feedbackItems).map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-gray-800 mb-2">{item.message}</p>
                    <p className="text-xs text-gray-400">
                      Created: {formatDate(item.created_at)}
                      {item.is_archived && item.archived_at && (
                        <> • Archived: {formatDate(item.archived_at)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setEditMessage(item.message);
                          }}
                          className="p-2 hover:bg-blue-100 rounded"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4 text-blue-600" />
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Feedback</DialogTitle>
                          <DialogDescription>
                            Make changes to your feedback message.
                          </DialogDescription>
                        </DialogHeader>
                        <Textarea
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          className="min-h-[120px]"
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setEditingItem(null)}>
                            Cancel
                          </Button>
                          <Button onClick={() => handleEdit(item)} className="bg-orange-300 hover:bg-orange-400">
                            Save Changes
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <button
                      onClick={() => handleArchive(item.id, item.is_archived || false)}
                      className="p-2 hover:bg-gray-100 rounded"
                      title={item.is_archived ? "Unarchive" : "Archive"}
                    >
                      {item.is_archived ? (
                        <ArchiveRestore className="h-4 w-4 text-gray-600" />
                      ) : (
                        <Archive className="h-4 w-4 text-gray-600" />
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 hover:bg-red-100 rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}