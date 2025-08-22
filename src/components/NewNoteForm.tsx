'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { NewEntryForm } from '@/components/NewEntryForm';

interface NewNoteFormProps {
  onEntryCreated?: (entry: any) => void;
}

export const NewNoteForm: React.FC<NewNoteFormProps> = ({ onEntryCreated }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="flex items-center gap-2">
        <FileText className="h-4 w-4" />
        Note
      </Button>
      
      <NewEntryForm
        onEntryCreated={(entry) => {
          if (onEntryCreated) onEntryCreated(entry);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
        defaultType="note"
        hideTypeSelector={true}
        open={open}
        setOpen={setOpen}
      />
    </>
  );
};