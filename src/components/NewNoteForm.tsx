'use client'

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { NewEntryForm } from '@/components/NewEntryForm';

interface NewNoteFormProps {
  onEntryCreated?: (entry: any) => void;
}

export const NewNoteForm: React.FC<NewNoteFormProps> = ({ onEntryCreated }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Note
      </Button>
      
      {open && (
        <NewEntryForm
          onEntryCreated={(entry) => {
            if (onEntryCreated) onEntryCreated(entry);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          defaultType="note"
        />
      )}
    </>
  );
};