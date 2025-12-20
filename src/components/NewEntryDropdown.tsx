'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, CheckSquare, FileText, CheckCircle2, MessageSquare, UserPlus } from 'lucide-react';
import { NewEntryForm } from './NewEntryForm';
import { DoneEntryForm } from './DoneEntryForm';
import { NewCommunicationForm } from './NewCommunicationForm';
import { NewRelationshipForm } from './NewRelationshipForm';

interface NewEntryDropdownProps {
  onEntryCreated?: () => void;
}

export const NewEntryDropdown: React.FC<NewEntryDropdownProps> = ({ onEntryCreated }) => {
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [doneFormOpen, setDoneFormOpen] = useState(false);
  const [commFormOpen, setCommFormOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setTaskFormOpen(true)}>
            <CheckSquare className="mr-2 h-4 w-4" />
            Task
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setNoteFormOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Note
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDoneFormOpen(true)}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Done
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setContactFormOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Contact
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCommFormOpen(true)}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Communication
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Task Form */}
      <NewEntryForm
        onEntryCreated={(entry) => {
          if (onEntryCreated) onEntryCreated();
          setTaskFormOpen(false);
        }}
        onClose={() => setTaskFormOpen(false)}
        defaultType="task"
        hideTypeSelector={true}
        open={taskFormOpen}
        setOpen={setTaskFormOpen}
      />

      {/* Note Form */}
      <NewEntryForm
        onEntryCreated={(entry) => {
          if (onEntryCreated) onEntryCreated();
          setNoteFormOpen(false);
        }}
        onClose={() => setNoteFormOpen(false)}
        defaultType="note"
        hideTypeSelector={true}
        open={noteFormOpen}
        setOpen={setNoteFormOpen}
      />

      {/* Done Form */}
      <DoneEntryForm
        onEntryCreated={onEntryCreated}
        open={doneFormOpen}
        setOpen={setDoneFormOpen}
      />

      {/* Contact Form */}
      <NewRelationshipForm
        onRelationshipCreated={onEntryCreated}
        open={contactFormOpen}
        setOpen={setContactFormOpen}
      />

      {/* Communication Form */}
      <NewCommunicationForm
        onCommunicationCreated={onEntryCreated}
        open={commFormOpen}
        setOpen={setCommFormOpen}
      />
    </>
  );
};

export default NewEntryDropdown;
