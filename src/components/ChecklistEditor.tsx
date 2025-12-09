'use client'

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GripVertical, Plus, X } from 'lucide-react';
import { useChecklists } from '@/hooks/useChecklists';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import type { ChecklistTemplateWithDetails, ChecklistContext, RecurrenceRule } from '@/types/checklist.types';

interface ChecklistEditorProps {
  template: ChecklistTemplateWithDetails;
  onClose: () => void;
  onSave: () => void;
}

const CONTEXT_OPTIONS: ChecklistContext[] = ['Morning', 'Work', 'Family', 'Evening', 'Weekend'];

export function ChecklistEditor({ template, onClose, onSave }: ChecklistEditorProps) {
  const { user } = useSupabaseAuth();
  const { updateTemplate } = useChecklists(user?.id);

  const [name, setName] = useState(template.name);
  const [items, setItems] = useState(
    template.items
      .sort((a, b) => a.order_index - b.order_index)
      .map(item => ({ id: item.id, text: item.item_text }))
  );
  const [selectedContexts, setSelectedContexts] = useState<string[]>(
    template.contexts.map(c => c.context)
  );
  const [hasFrequency, setHasFrequency] = useState(!!template.recurrence_rule);
  const [frequencyType, setFrequencyType] = useState<'daily' | 'weekly' | 'monthly'>(
    (template.recurrence_rule?.type as 'daily' | 'weekly' | 'monthly') || 'daily'
  );
  const [interval, setInterval] = useState(template.recurrence_rule?.interval || 1);
  const [selectedDays, setSelectedDays] = useState<string[]>(
    template.recurrence_rule?.days_of_week || []
  );
  const [selectedDaysOfMonth, setSelectedDaysOfMonth] = useState<number[]>(
    template.recurrence_rule?.days_of_month || []
  );
  const [isMajorUpdate, setIsMajorUpdate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const dayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleContextToggle = (context: string) => {
    setSelectedContexts(prev =>
      prev.includes(context)
        ? prev.filter(c => c !== context)
        : [...prev, context]
    );
  };

  const handleDayToggle = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const handleDayOfMonthToggle = (day: number) => {
    setSelectedDaysOfMonth(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleAddItem = () => {
    setItems([...items, { id: `new-${Date.now()}`, text: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index].text = value;
    setItems(newItems);
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);

    setItems(newItems);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSubmit = async () => {
    if (loading || name.trim().length === 0) return;

    const filteredItems = items.filter(item => item.text.trim().length > 0);
    if (filteredItems.length === 0) {
      alert('Please add at least one checklist item');
      return;
    }

    setLoading(true);
    try {
      const itemsWithOrder = filteredItems.map((item, index) => ({
        id: item.id.startsWith('new-') ? undefined : item.id,
        item_text: item.text.trim(),
        order_index: index
      }));

      let recurrenceRule: RecurrenceRule | null = null;
      if (hasFrequency) {
        const getLocalDateString = (): string => {
          const date = new Date();
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        recurrenceRule = {
          type: frequencyType,
          start_date: template.recurrence_rule?.start_date || getLocalDateString(),
          interval,
          unit: frequencyType === 'daily' ? 'day' : frequencyType === 'weekly' ? 'week' : 'month',
          ...(frequencyType === 'weekly' && selectedDays.length > 0 && { days_of_week: selectedDays }),
          ...(frequencyType === 'monthly' && selectedDaysOfMonth.length > 0 && { days_of_month: selectedDaysOfMonth }),
          end_condition: { type: 'none' }
        };
      }

      await updateTemplate(
        template.id,
        name.trim(),
        itemsWithOrder,
        selectedContexts,
        recurrenceRule,
        isMajorUpdate
      );

      onSave();
    } catch (error) {
      console.error('Error updating checklist:', error);
      alert('Failed to update checklist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Checklist</DialogTitle>
          <div className="text-sm text-gray-500">
            Current version: {template.version.toFixed(1)}
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Name */}
          <div>
            <Label htmlFor="name">Checklist Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning Routine"
              className="mt-1"
            />
          </div>

          {/* Context */}
          <div>
            <Label>Context (Optional)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {CONTEXT_OPTIONS.map(context => (
                <button
                  key={context}
                  type="button"
                  onClick={() => handleContextToggle(context)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedContexts.includes(context)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {context}
                </button>
              ))}
            </div>
          </div>

          {/* Items */}
          <div>
            <Label>Checklist Items</Label>
            <p className="text-sm text-gray-500 mb-2">Drag items to reorder</p>
            <div className="space-y-2 mt-2">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex gap-2 items-center ${
                    draggedIndex === index ? 'opacity-50' : ''
                  }`}
                >
                  <GripVertical className="h-5 w-5 text-gray-400 cursor-move flex-shrink-0" />
                  <Input
                    value={item.text}
                    onChange={(e) => handleItemChange(index, e.target.value)}
                    placeholder={`Item ${index + 1}`}
                    className="flex-1"
                  />
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleAddItem}
              className="mt-3"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          {/* Frequency */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="hasFrequency"
                checked={hasFrequency}
                onChange={(e) => setHasFrequency(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="hasFrequency">
                Frequency for streak tracking
              </Label>
            </div>

            {hasFrequency && (
              <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                <div>
                  <Label>Frequency Type</Label>
                  <select
                    value={frequencyType}
                    onChange={(e) => setFrequencyType(e.target.value as 'daily' | 'weekly' | 'monthly')}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <Label>Every</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      min="1"
                      value={interval}
                      onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
                      className="w-20"
                    />
                    <span className="text-sm text-gray-600">
                      {frequencyType === 'daily' && 'day(s)'}
                      {frequencyType === 'weekly' && 'week(s)'}
                      {frequencyType === 'monthly' && 'month(s)'}
                    </span>
                  </div>
                </div>

                {frequencyType === 'weekly' && (
                  <div>
                    <Label>On these days</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {dayOptions.map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDayToggle(day)}
                          className={`px-3 py-1 rounded-md text-sm ${
                            selectedDays.includes(day)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {day.substring(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {frequencyType === 'monthly' && (
                  <div>
                    <Label>On these days of the month</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDayOfMonthToggle(day)}
                          className={`w-10 h-10 rounded-md text-sm ${
                            selectedDaysOfMonth.includes(day)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Version Update Type */}
          <div className="border-t pt-4">
            <Label>Update Type</Label>
            <div className="space-y-2 mt-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="minorUpdate"
                  name="updateType"
                  checked={!isMajorUpdate}
                  onChange={() => setIsMajorUpdate(false)}
                  className="rounded-full"
                />
                <Label htmlFor="minorUpdate" className="font-normal cursor-pointer">
                  Minor update (+0.1) - Small changes, fixes
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="majorUpdate"
                  name="updateType"
                  checked={isMajorUpdate}
                  onChange={() => setIsMajorUpdate(true)}
                  className="rounded-full"
                />
                <Label htmlFor="majorUpdate" className="font-normal cursor-pointer">
                  Major update (+1.0) - Significant changes
                </Label>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              New version will be: {isMajorUpdate
                ? (Math.floor(template.version) + 1).toFixed(1)
                : (template.version + 0.1).toFixed(1)
              }
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || name.trim().length === 0}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
