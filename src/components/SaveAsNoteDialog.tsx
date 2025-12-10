'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SaveAsNoteDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSave: (title: string) => void
  currentContent: string
}

export function SaveAsNoteDialog({
  isOpen,
  onOpenChange,
  onSave,
  currentContent
}: SaveAsNoteDialogProps) {
  const [title, setTitle] = useState('')

  const handleSave = () => {
    if (title.trim()) {
      onSave(title.trim())
      setTitle('')
      onOpenChange(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Save as Formal Note</DialogTitle>
          <DialogDescription>
            This will convert your train of thought into a formal note that appears in your Notes tab.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Note Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter a title for this note..."
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>Preview</Label>
            <div className="text-sm text-gray-600 max-h-32 overflow-y-auto border rounded p-2 bg-gray-50">
              {currentContent || '(empty)'}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            Save as Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
