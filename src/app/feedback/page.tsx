'use client'

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import AuthUI from '@/components/Auth';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const FeedbackTable = ({ items, isArchived = false }: { items: FeedbackItem[], isArchived?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Feedback</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="max-w-md">
              <div className="truncate">
                {item.message}
              </div>
            </TableCell>
            <TableCell>
              {formatDate(isArchived ? item.archived_at || item.created_at : item.created_at)}
            </TableCell>
            <TableCell>
              <Badge variant={isArchived ? "secondary" : "default"}>
                {isArchived ? 'Archived' : 'Active'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingItem(item);
                        setEditMessage(item.message);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
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
                      <Button onClick={() => handleEdit(item)}>
                        Save Changes
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleArchive(item.id, item.is_archived)}
                >
                  {isArchived ? (
                    <ArchiveRestore className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(item.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

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
          <h1 className="text-3xl font-bold">Feedback Management</h1>
          <p className="text-muted-foreground">
            Manage and track your feedback submissions
          </p>
        </div>
        <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Feedback
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
              <Button onClick={handleAddNew} disabled={!newFeedback.trim()}>
                Submit Feedback
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Feedback */}
      <Card>
        <CardHeader>
          <CardTitle>Active Feedback ({feedbackItems.length})</CardTitle>
          <CardDescription>
            Your current feedback items that need attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feedbackItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active feedback items. Add some feedback to get started!
            </div>
          ) : (
            <FeedbackTable items={feedbackItems} />
          )}
        </CardContent>
      </Card>

      {/* Archived Feedback */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Archived Feedback ({archivedItems.length})</CardTitle>
              <CardDescription>
                Feedback items that have been addressed or completed
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? 'Hide' : 'Show'} Archived
            </Button>
          </div>
        </CardHeader>
        {showArchived && (
          <CardContent>
            {archivedItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No archived feedback items yet.
              </div>
            ) : (
              <FeedbackTable items={archivedItems} isArchived={true} />
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}