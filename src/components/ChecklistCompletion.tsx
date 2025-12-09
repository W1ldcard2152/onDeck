'use client'

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckSquare, Square } from 'lucide-react';
import { useChecklists } from '@/hooks/useChecklists';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import type { ChecklistTemplateWithDetails, CheckedItem } from '@/types/checklist.types';

interface ChecklistCompletionProps {
  template: ChecklistTemplateWithDetails;
  onClose: () => void;
  onComplete: () => void;
}

export function ChecklistCompletion({ template, onClose, onComplete }: ChecklistCompletionProps) {
  const { user } = useSupabaseAuth();
  const { completeChecklist } = useChecklists(user?.id);

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleToggleItem = (itemId: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleSubmit = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const items: CheckedItem[] = template.items.map(item => ({
        item_id: item.id,
        item_text: item.item_text,
        checked: checkedItems[item.id] || false,
        order_index: item.order_index
      }));

      await completeChecklist(template.id, items, notes.trim() || null);
      onComplete();
    } catch (error) {
      console.error('Error completing checklist:', error);
      alert('Failed to complete checklist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalCount = template.items.length;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <div className="text-sm text-gray-500 mt-1">
            {checkedCount} of {totalCount} items checked
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Checklist Items */}
          <div className="space-y-2">
            {template.items
              .sort((a, b) => a.order_index - b.order_index)
              .map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleToggleItem(item.id)}
                  className="flex items-start gap-3 w-full p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {checkedItems[item.id] ? (
                      <CheckSquare className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <span
                    className={`flex-1 ${
                      checkedItems[item.id]
                        ? 'line-through text-gray-400'
                        : 'text-gray-900'
                    }`}
                  >
                    {item.item_text}
                  </span>
                </button>
              ))}
          </div>

          {/* Notes Section */}
          <div className="border-t pt-4">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <p className="text-sm text-gray-500 mb-2">
              Explain why anything was unchecked, or add any additional notes
            </p>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes here..."
              rows={4}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Completing...' : 'Complete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
