'use client'

import React from 'react'
import { History } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { NoteWithDetails } from '@/lib/types'
import { format } from 'date-fns'

interface ThoughtHistoryProps {
  thoughts: NoteWithDetails[]
  onSelect: (thoughtId: string) => void
}

export function ThoughtHistory({ thoughts, onSelect }: ThoughtHistoryProps) {
  if (thoughts.length === 0) {
    return null
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a')
    } catch {
      return dateString
    }
  }

  const getPreview = (content: string | null) => {
    if (!content) return '(empty)'
    const preview = content.slice(0, 60)
    return preview.length < content.length ? `${preview}...` : preview
  }

  return (
    <div className="flex items-center gap-2">
      <History className="h-4 w-4 text-gray-500" />
      <Select onValueChange={onSelect}>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="View previous thoughts..." />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>History ({thoughts.length})</SelectLabel>
            {thoughts.map((thought) => (
              <SelectItem key={thought.id} value={thought.id}>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {formatDate(thought.item.created_at)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {getPreview(thought.content)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
