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
import { TimePicker } from "@/components/ui/time-picker";
import { Plus } from 'lucide-react';
import { useHabits, type RecurrenceRule, type Habit } from '@/hooks/useHabits';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

interface NewHabitFormProps {
  onHabitCreated: () => void;
  editingHabit?: Habit | null;
  onHabitUpdated?: () => void;
}

const NewHabitForm = ({ onHabitCreated, editingHabit, onHabitUpdated }: NewHabitFormProps) => {
  console.log('NewHabitForm loaded - Monthly scheduling available!');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [frequencyType, setFrequencyType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [interval, setInterval] = useState(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedDaysOfMonth, setSelectedDaysOfMonth] = useState<number[]>([]);
  const [timeOfDay, setTimeOfDay] = useState('');
  const [startDate, setStartDate] = useState('');
  const [offsetDays, setOffsetDays] = useState(0);
  
  const { user } = useSupabaseAuth();
  const { createHabit, updateHabit } = useHabits(user?.id);

  const dayOptions = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ];

  // Effect to handle editing habit
  React.useEffect(() => {
    if (editingHabit) {
      setOpen(true);
      setTitle(editingHabit.title);
      setDescription(editingHabit.description || '');
      setPriority(editingHabit.priority);
      
      const rule = editingHabit.recurrence_rule;
      setFrequencyType(rule.type as 'daily' | 'weekly' | 'monthly');
      setInterval(rule.interval || 1);
      setSelectedDays(rule.days_of_week || []);
      setSelectedDaysOfMonth(rule.days_of_month || []);
      setTimeOfDay(rule.time_of_day || '');
      setStartDate(rule.start_date || '');
      setOffsetDays(rule.offset_days || 0);
    }
  }, [editingHabit]);

  // Separate effect to handle clearing edit state
  const prevEditingHabit = React.useRef(editingHabit);
  React.useEffect(() => {
    // Only reset form if we were editing and now we're not
    if (prevEditingHabit.current && !editingHabit) {
      setTitle('');
      setDescription('');
      setPriority('normal');
      setFrequencyType('daily');
      setInterval(1);
      setSelectedDays([]);
      setSelectedDaysOfMonth([]);
      setTimeOfDay('');
      setStartDate('');
      setOffsetDays(0);
      if (open) {
        setOpen(false);
      }
    }
    prevEditingHabit.current = editingHabit;
  }, [editingHabit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || loading) return;

    setLoading(true);
    try {
      // Helper function to get local date in YYYY-MM-DD format
      const getLocalDateString = (date: Date = new Date()): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const recurrenceRule: RecurrenceRule = {
        type: frequencyType,
        start_date: startDate || getLocalDateString(), // Use selected start_date or default to today in local timezone
        interval,
        unit: frequencyType === 'daily' ? 'day' : frequencyType === 'weekly' ? 'week' : 'month',
        ...(frequencyType === 'weekly' && selectedDays.length > 0 && { days_of_week: selectedDays }),
        ...(frequencyType === 'monthly' && selectedDaysOfMonth.length > 0 && { days_of_month: selectedDaysOfMonth }),
        ...(timeOfDay && { time_of_day: timeOfDay }),
        ...(frequencyType === 'daily' && offsetDays > 0 && { offset_days: offsetDays }),
        end_condition: { type: 'none' }
      };

      if (editingHabit) {
        // Update existing habit
        await updateHabit(editingHabit.id, {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          recurrence_rule: recurrenceRule,
        });
        onHabitUpdated?.();
      } else {
        // Create new habit
        await createHabit({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          recurrence_rule: recurrenceRule,
          is_active: true
        });
        onHabitCreated();
      }

      // Reset form
      setTitle('');
      setDescription('');
      setPriority('normal');
      setFrequencyType('daily');
      setInterval(1);
      setSelectedDays([]);
      setSelectedDaysOfMonth([]);
      setTimeOfDay('');
      setStartDate('');
      setOffsetDays(0);
      setOpen(false);
      
    } catch (error) {
      console.error(`Error ${editingHabit ? 'updating' : 'creating'} habit:`, error);
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

  const handleDayOfMonthToggle = (day: number) => {
    setSelectedDaysOfMonth(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="flex items-center gap-2">
        <Plus className="h-4 w-4" />
        New Habit
      </Button>

      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen && editingHabit) {
          // If closing the dialog while editing, notify parent to clear edit state
          onHabitUpdated?.();
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingHabit ? 'Edit Habit' : 'Create New Habit'}</DialogTitle>
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
              <Label>Time of Day (optional)</Label>
              <TimePicker
                value={timeOfDay}
                onChange={setTimeOfDay}
              />
              <p className="text-sm text-gray-500">
                Set a preferred time for this habit (e.g., 7:00 AM for morning jog)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} // Can't start in the past
              />
              <p className="text-sm text-gray-500">
                When should this habit start? Leave empty to start today.
              </p>
            </div>

            {frequencyType === 'daily' && (
              <div className="space-y-2">
                <Label htmlFor="offsetDays">Offset Days</Label>
                <Input
                  id="offsetDays"
                  type="number"
                  min="0"
                  max="30"
                  value={offsetDays}
                  onChange={(e) => setOffsetDays(parseInt(e.target.value) || 0)}
                  className="w-20"
                />
                <p className="text-sm text-gray-500">
                  Start this habit X days from today (0 = start today)
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={frequencyType} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => {
                setFrequencyType(value);
                setSelectedDays([]);
                setSelectedDaysOfMonth([]);
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

            {frequencyType === 'monthly' && (
              <div className="space-y-2">
                <Label>Days of Month</Label>
                <div className="grid grid-cols-8 gap-1">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleDayOfMonthToggle(day)}
                      className={`px-2 py-2 text-sm rounded-md border ${
                        selectedDaysOfMonth.includes(day)
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Select one or more days of the month (1-31)</p>
                  <p>💡 For months with fewer days, the habit will skip (e.g., day 31 won't occur in February)</p>
                  {selectedDaysOfMonth.length > 0 && (
                    <p className="font-medium">
                      Selected: {selectedDaysOfMonth.join(', ')} of each month
                    </p>
                  )}
                </div>
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
                disabled={loading || !title.trim() || 
                         (frequencyType === 'weekly' && selectedDays.length === 0) ||
                         (frequencyType === 'monthly' && selectedDaysOfMonth.length === 0)}
              >
                {loading 
                  ? (editingHabit ? 'Updating...' : 'Creating...')
                  : (editingHabit ? 'Update Habit' : 'Create Habit')
                }
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