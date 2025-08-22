'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckSquare } from 'lucide-react';
import { NewEntryForm } from '@/components/NewEntryForm';

interface NewTaskFormProps {
  onEntryCreated?: (entry: any) => void;
}

export const NewTaskForm: React.FC<NewTaskFormProps> = ({ onEntryCreated }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4" />
        Task
      </Button>
      
      <NewEntryForm
        onEntryCreated={(entry) => {
          if (onEntryCreated) onEntryCreated(entry);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
        defaultType="task"
        hideTypeSelector={true}
        open={open}
        setOpen={setOpen}
      />
    </>
  );
};