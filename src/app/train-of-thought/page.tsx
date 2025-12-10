'use client'

import React, { useState, useEffect } from 'react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { useTrainOfThought } from '@/hooks/useTrainOfThought'
import { SaveAsNoteDialog } from '@/components/SaveAsNoteDialog'
import { ThoughtHistory } from '@/components/ThoughtHistory'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Save, Eraser, StickyNote } from 'lucide-react'
import { format } from 'date-fns'

export default function TrainOfThoughtPage() {
  const { user } = useSupabaseAuth()
  const {
    currentThought,
    thoughtHistory,
    isLoading,
    isSaving,
    lastSaved,
    error,
    saveThought,
    saveNow,
    clearAll,
    saveAsNote,
    loadFromHistory
  } = useTrainOfThought(user?.id)

  const [content, setContent] = useState('')
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)

  // Sync content with current thought
  useEffect(() => {
    if (currentThought) {
      setContent(currentThought.content || '')
    } else {
      setContent('')
    }
  }, [currentThought])

  // Handle content change with auto-save
  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    saveThought(newContent)
  }

  const handleManualSave = () => {
    saveNow(content)
  }

  const handleClearAll = async () => {
    await clearAll()
    setContent('')
  }

  const handleSaveAsNote = async (title: string) => {
    await saveAsNote(title)
    setContent('')
  }

  const handleLoadFromHistory = async (thoughtId: string) => {
    await loadFromHistory(thoughtId)
  }

  const formatLastSaved = () => {
    if (!lastSaved) return ''
    try {
      return format(lastSaved, 'h:mm a')
    } catch {
      return ''
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-600">Error: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="hidden sm:flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Train of Thought</h1>
            <p className="text-sm text-gray-500 mt-1">
              Quick scratchpad for temporary notes, numbers, and thoughts
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSaveDialogOpen(true)}
              disabled={!content.trim()}
            >
              <StickyNote className="h-4 w-4 mr-2" />
              Save as Note
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={!content.trim()}
            >
              <Eraser className="h-4 w-4 mr-2" />
              Clear All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSave}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
        <div className="sm:hidden space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Train of Thought</h1>
            <p className="text-sm text-gray-500 mt-1">
              Quick scratchpad for temporary notes
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSaveDialogOpen(true)}
              disabled={!content.trim()}
            >
              <StickyNote className="h-4 w-4 mr-2" />
              Save as Note
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={!content.trim()}
            >
              <Eraser className="h-4 w-4 mr-2" />
              Clear All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSave}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Textarea */}
      <div className="bg-white rounded-xl shadow-sm">
        <Textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Start typing... Your thoughts will auto-save after 2 seconds of inactivity."
          className="min-h-[500px] resize-none border-0 focus-visible:ring-0 text-base p-6"
          maxLength={50000}
        />
      </div>

      {/* Footer with save status and history */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {isSaving && <span className="text-blue-600">Saving...</span>}
          {!isSaving && lastSaved && (
            <span>Last saved at {formatLastSaved()}</span>
          )}
          {!isSaving && !lastSaved && (
            <span>Not saved yet</span>
          )}
          <span className="ml-4 text-gray-400">
            {content.length.toLocaleString()} / 50,000 characters
          </span>
        </div>
        <ThoughtHistory
          thoughts={thoughtHistory}
          onSelect={handleLoadFromHistory}
        />
      </div>

      {/* Save as Note Dialog */}
      <SaveAsNoteDialog
        isOpen={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        onSave={handleSaveAsNote}
        currentContent={content}
      />
    </div>
  )
}
