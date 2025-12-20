'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, UserPlus, MessageSquare } from 'lucide-react';
import { NewRelationshipForm } from './NewRelationshipForm';
import { NewCommunicationForm } from './NewCommunicationForm';

interface NewRelationshipEntryDropdownProps {
  onEntryCreated?: () => void;
}

export const NewRelationshipEntryDropdown: React.FC<NewRelationshipEntryDropdownProps> = ({ onEntryCreated }) => {
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [commFormOpen, setCommFormOpen] = useState(false);

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

export default NewRelationshipEntryDropdown;
