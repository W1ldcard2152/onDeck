'use client'

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, UserPlus, X } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useCommunications } from '@/hooks/useCommunications';
import { useRelationships } from '@/hooks/useRelationships';
import type { CommunicationMedium, TimeOfDay } from '@/types/database.types';

interface NewCommunicationFormProps {
  onCommunicationCreated?: () => void;
  onClose?: () => void;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  defaultRelationshipId?: string;
}

export const NewCommunicationForm: React.FC<NewCommunicationFormProps> = ({
  onCommunicationCreated,
  onClose,
  open: controlledOpen,
  setOpen: controlledSetOpen,
  defaultRelationshipId
}) => {
  const { user } = useSupabaseAuth();
  const { createCommunication } = useCommunications(user?.id);
  const { relationships, createRelationship } = useRelationships(user?.id);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledSetOpen || setInternalOpen;

  const [relationshipId, setRelationshipId] = useState(defaultRelationshipId || '');
  const [medium, setMedium] = useState<CommunicationMedium>('Phone Call');
  const [mediumOther, setMediumOther] = useState('');
  const [summary, setSummary] = useState('');
  const [communicationDate, setCommunicationDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('Morning');
  const [timeOfDayOther, setTimeOfDayOther] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick-add relationship state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newRelName, setNewRelName] = useState('');
  const [newRelPhone, setNewRelPhone] = useState('');
  const [newRelEmail, setNewRelEmail] = useState('');

  useEffect(() => {
    if (defaultRelationshipId) {
      setRelationshipId(defaultRelationshipId);
    }
  }, [defaultRelationshipId]);

  const resetForm = () => {
    setRelationshipId(defaultRelationshipId || '');
    setMedium('Phone Call');
    setMediumOther('');
    setSummary('');
    setCommunicationDate(new Date().toISOString().split('T')[0]);
    setTimeOfDay('Morning');
    setTimeOfDayOther('');
    setError(null);
    setShowQuickAdd(false);
    setNewRelName('');
    setNewRelPhone('');
    setNewRelEmail('');
  };

  const handleClose = () => {
    resetForm();
    setOpen(false);
    if (onClose) {
      onClose();
    }
  };

  const handleQuickAddRelationship = async () => {
    if (!newRelName.trim()) {
      setError('Name is required to add a new contact');
      return;
    }

    try {
      const newRel = await createRelationship({
        name: newRelName.trim(),
        phone: newRelPhone.trim() || undefined,
        email: newRelEmail.trim() || undefined,
      });

      // Auto-select the newly created relationship
      setRelationshipId(newRel.id);

      // Hide quick-add form
      setShowQuickAdd(false);
      setNewRelName('');
      setNewRelPhone('');
      setNewRelEmail('');
      setError(null);

      // Notify parent that data has changed (triggers refetch on relationships page)
      if (onCommunicationCreated) {
        onCommunicationCreated();
      }
    } catch (err) {
      console.error('Error creating relationship:', err);
      setError(err instanceof Error ? err.message : 'Failed to create contact');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!relationshipId) {
      setError('Please select a person');
      return;
    }

    if (!summary.trim()) {
      setError('Summary is required');
      return;
    }

    if (medium === 'Other' && !mediumOther.trim()) {
      setError('Please specify the communication medium');
      return;
    }

    if (timeOfDay === 'Other' && !timeOfDayOther.trim()) {
      setError('Please specify the time of day');
      return;
    }

    if (!user) {
      setError('You must be logged in to add a communication');
      return;
    }

    setIsSubmitting(true);

    try {
      await createCommunication({
        relationship_id: relationshipId,
        medium,
        medium_other: medium === 'Other' ? mediumOther.trim() : undefined,
        summary: summary.trim(),
        communication_date: new Date(communicationDate).toISOString(),
        time_of_day: timeOfDay,
        time_of_day_other: timeOfDay === 'Other' ? timeOfDayOther.trim() : undefined,
      });

      if (onCommunicationCreated) {
        onCommunicationCreated();
      }

      handleClose();
      resetForm();
    } catch (err) {
      console.error('Error saving communication:', err);
      setError(err instanceof Error ? err.message : 'Failed to save communication');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button>
            <MessageSquare className="h-4 w-4 mr-2" />
            Add Communication
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Communication</DialogTitle>
          <DialogDescription>
            Log a conversation or communication with someone.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="relationship">Person *</Label>
            {!showQuickAdd ? (
              <>
                <Select value={relationshipId} onValueChange={setRelationshipId} required>
                  <SelectTrigger id="relationship">
                    <SelectValue placeholder="Select a person..." />
                  </SelectTrigger>
                  <SelectContent>
                    {relationships.map((rel) => (
                      <SelectItem key={rel.id} value={rel.id}>
                        {rel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuickAdd(true)}
                  className="w-full mt-2"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add New Contact
                </Button>
              </>
            ) : (
              <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">New Contact</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowQuickAdd(false);
                      setNewRelName('');
                      setNewRelPhone('');
                      setNewRelEmail('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newRelName">Name *</Label>
                  <Input
                    id="newRelName"
                    type="text"
                    placeholder="John Doe"
                    value={newRelName}
                    onChange={(e) => setNewRelName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newRelPhone">Phone</Label>
                  <Input
                    id="newRelPhone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={newRelPhone}
                    onChange={(e) => setNewRelPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newRelEmail">Email</Label>
                  <Input
                    id="newRelEmail"
                    type="email"
                    placeholder="john@example.com"
                    value={newRelEmail}
                    onChange={(e) => setNewRelEmail(e.target.value)}
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleQuickAddRelationship}
                  className="w-full"
                >
                  Save Contact
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="medium">Communication Method *</Label>
            <Select value={medium} onValueChange={(value) => setMedium(value as CommunicationMedium)} required>
              <SelectTrigger id="medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Phone Call">Phone Call</SelectItem>
                <SelectItem value="Text">Text</SelectItem>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="In Person">In Person</SelectItem>
                <SelectItem value="Video Call">Video Call</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {medium === 'Other' && (
            <div className="space-y-2">
              <Label htmlFor="mediumOther">Specify Method *</Label>
              <Input
                id="mediumOther"
                type="text"
                placeholder="e.g., Letter, Social Media"
                value={mediumOther}
                onChange={(e) => setMediumOther(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="communicationDate">Date *</Label>
            <Input
              id="communicationDate"
              type="date"
              value={communicationDate}
              onChange={(e) => setCommunicationDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeOfDay">Time of Day</Label>
            <Select value={timeOfDay || 'Morning'} onValueChange={(value) => setTimeOfDay(value as TimeOfDay)}>
              <SelectTrigger id="timeOfDay">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Morning">Morning</SelectItem>
                <SelectItem value="Afternoon">Afternoon</SelectItem>
                <SelectItem value="Evening">Evening</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {timeOfDay === 'Other' && (
            <div className="space-y-2">
              <Label htmlFor="timeOfDayOther">Specify Time *</Label>
              <Input
                id="timeOfDayOther"
                type="text"
                placeholder="e.g., Late Night"
                value={timeOfDayOther}
                onChange={(e) => setTimeOfDayOther(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="summary">Summary *</Label>
            <Textarea
              id="summary"
              placeholder="What did you discuss?"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              required
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
              {isSubmitting ? 'Saving...' : 'Add Communication'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewCommunicationForm;
