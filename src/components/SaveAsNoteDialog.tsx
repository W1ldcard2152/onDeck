'use client'

import React, { useState, useEffect } from 'react'
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
import { Textarea } from "@/components/ui/textarea"

interface SaveAsNoteDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSave: (title: string, content: string) => void
  currentContent: string
  description?: string
}

export function SaveAsNoteDialog({
  isOpen,
  onOpenChange,
  onSave,
  currentContent,
  description
}: SaveAsNoteDialogProps) {
  const [title, setTitle] = useState('')
  const [editedContent, setEditedContent] = useState('')

  // Initialize edited content when dialog opens
  useEffect(() => {
    if (isOpen) {
      setEditedContent(currentContent)
    }
  }, [isOpen, currentContent])

  const handleSave = () => {
    if (title.trim()) {
      onSave(title.trim(), editedContent)
      setTitle('')
      setEditedContent('')
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
      <DialogContent className="w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] sm:w-[calc(100vw-400px)] sm:h-[calc(100vh-60px)] max-w-none flex flex-col">
        <DialogHeader>
          <DialogTitle>Save as Formal Note</DialogTitle>
          <DialogDescription>
            {description || 'This will convert your train of thought into a formal note that appears in your Notes tab.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4 flex-1 min-h-0">
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
          <div className="flex flex-col gap-2 flex-1 min-h-0">
            <Label>Content</Label>
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="flex-1 text-sm resize-none"
            />
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
