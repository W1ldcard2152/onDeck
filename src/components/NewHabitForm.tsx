'use client'

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from 'lucide-react';
import { useHabits, type RecurrenceRule } from '@/hooks/useHabits';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

interface NewHabitFormProps {
  onHabitCreated: () => void;
}

const NewHabitForm = ({ onHabitCreated }: NewHabitFormProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [frequencyType, setFrequencyType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [interval, setInterval] = useState(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  
  const { user } = useSupabaseAuth();
  const { createHabit } = useHabits(user?.id);

  const dayOptions = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || loading) return;

    setLoading(true);
    try {
      const recurrenceRule: RecurrenceRule = {
        type: frequencyType,
        start_date: new Date().toISOString().split('T')[0], // Use YYYY-MM-DD format for today
        interval,
        unit: frequencyType === 'daily' ? 'day' : frequencyType === 'weekly' ? 'week' : 'month',
        ...(frequencyType === 'weekly' && selectedDays.length > 0 && { days_of_week: selectedDays }),
        end_condition: { type: 'none' }
      };

      await createHabit({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        recurrence_rule: recurrenceRule,
        is_active: true
      });

      // Reset form
      setTitle('');
      setDescription('');
      setPriority('normal');
      setFrequencyType('daily');
      setInterval(1);
      setSelectedDays([]);
      setOpen(false);
      
      onHabitCreated();
    } catch (error) {
      console.error('Error creating habit:', error);
      // Handle error (you might want to show a toast or error message)
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="flex items-center gap-2">
        <Plus className="h-4 w-4" />
        New Habit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Habit</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Morning Jog, Read for 30 minutes"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Any additional details about this habit..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(value: 'low' | 'normal' | 'high') => setPriority(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={frequencyType} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => {
                setFrequencyType(value);
                setSelectedDays([]);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interval">Every</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="interval"
                  type="number"
                  min="1"
                  max="30"
                  value={interval}
                  onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
                  className="w-20"
                />
                <span className="text-sm text-gray-600">
                  {frequencyType === 'daily' ? `day${interval === 1 ? '' : 's'}` :
                   frequencyType === 'weekly' ? `week${interval === 1 ? '' : 's'}` :
                   `month${interval === 1 ? '' : 's'}`}
                </span>
              </div>
            </div>

            {frequencyType === 'weekly' && (
              <div className="space-y-2">
                <Label>Days of Week</Label>
                <div className="flex flex-wrap gap-2">
                  {dayOptions.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleDayToggle(day)}
                      className={`px-3 py-1 text-sm rounded-md border ${
                        selectedDays.includes(day)
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
                {frequencyType === 'weekly' && selectedDays.length === 0 && (
                  <p className="text-sm text-gray-500">Select at least one day for weekly habits</p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !title.trim() || (frequencyType === 'weekly' && selectedDays.length === 0)}
              >
                {loading ? 'Creating...' : 'Create Habit'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export { NewHabitForm };
export default NewHabitForm;