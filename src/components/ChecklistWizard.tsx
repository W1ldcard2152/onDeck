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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, Trash2 } from 'lucide-react';
import { useChecklists } from '@/hooks/useChecklists';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import type { RecurrenceRule, ChecklistContext } from '@/types/checklist.types';

interface ChecklistWizardProps {
  onClose: () => void;
  onCreated: () => void;
}

const CONTEXT_OPTIONS: ChecklistContext[] = ['Morning', 'Work', 'Family', 'Evening', 'Weekend'];

export function ChecklistWizard({ onClose, onCreated }: ChecklistWizardProps) {
  const { user } = useSupabaseAuth();
  const { createTemplate } = useChecklists(user?.id);

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [items, setItems] = useState<string[]>(['', '', '', '', '']);
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
  const [hasFrequency, setHasFrequency] = useState(false);
  const [frequencyType, setFrequencyType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [interval, setInterval] = useState(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedDaysOfMonth, setSelectedDaysOfMonth] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const dayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleAddItem = () => {
    setItems([...items, '']);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    setItems(newItems);
  };

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

  const canProceedToStep2 = name.trim().length > 0;
  const canProceedToStep3 = items.filter(item => item.trim().length > 0).length > 0;
  const canSubmit = !hasFrequency || (
    (frequencyType !== 'weekly' || selectedDays.length > 0) &&
    (frequencyType !== 'monthly' || selectedDaysOfMonth.length > 0)
  );

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;

    setLoading(true);
    try {
      const filteredItems = items.filter(item => item.trim().length > 0);

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
          start_date: getLocalDateString(),
          interval,
          unit: frequencyType === 'daily' ? 'day' : frequencyType === 'weekly' ? 'week' : 'month',
          ...(frequencyType === 'weekly' && selectedDays.length > 0 && { days_of_week: selectedDays }),
          ...(frequencyType === 'monthly' && selectedDaysOfMonth.length > 0 && { days_of_month: selectedDaysOfMonth }),
          end_condition: { type: 'none' }
        };
      }

      await createTemplate(name.trim(), filteredItems, selectedContexts, recurrenceRule);
      onCreated();
    } catch (error) {
      console.error('Error creating checklist:', error);
      alert('Failed to create checklist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && 'Create Checklist - Name & Context'}
            {step === 2 && 'Create Checklist - Checklist Items'}
            {step === 3 && 'Create Checklist - Frequency (Optional)'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: Name and Context */}
          {step === 1 && (
            <>
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

              <div>
                <Label>Context (Optional)</Label>
                <p className="text-sm text-gray-500 mb-2">
                  Select one or more contexts, or leave blank for "All contexts"
                </p>
                <div className="flex flex-wrap gap-2">
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
            </>
          )}

          {/* Step 2: Items */}
          {step === 2 && (
            <div>
              <Label>Checklist Items</Label>
              <div className="space-y-2 mt-2">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={item}
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
          )}

          {/* Step 3: Frequency */}
          {step === 3 && (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasFrequency"
                  checked={hasFrequency}
                  onChange={(e) => setHasFrequency(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="hasFrequency">
                  Add frequency for streak tracking (Optional)
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
            </>
          )}
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (step === 1) {
                  onClose();
                } else {
                  setStep(step - 1);
                }
              }}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>

            <Button
              type="button"
              onClick={() => {
                if (step === 1 && canProceedToStep2) {
                  setStep(2);
                } else if (step === 2 && canProceedToStep3) {
                  setStep(3);
                } else if (step === 3 && canSubmit) {
                  handleSubmit();
                }
              }}
              disabled={
                (step === 1 && !canProceedToStep2) ||
                (step === 2 && !canProceedToStep3) ||
                (step === 3 && (!canSubmit || loading))
              }
            >
              {step === 3 ? (loading ? 'Creating...' : 'Create Checklist') : 'Next'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
