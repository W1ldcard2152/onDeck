'use client'

import React from 'react';
import { NoteWithDetails } from '@/lib/types';
import { format } from 'date-fns';
import { Calendar, FileText, Clock } from 'lucide-react';

interface NoteCardProps {
  note: NoteWithDetails;
  preview?: boolean;
}

export const NoteCard: React.FC<NoteCardProps> = React.memo(({ note, preview = false }) => {
  // Truncate content for preview while preserving words
  const truncateContent = (content: string, maxLength: number) => {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    const truncated = content.slice(0, maxLength).split(' ').slice(0, -1).join(' ');
    return `${truncated}...`;
  };

  const contentPreview = note.content 
    ? truncateContent(note.content, preview ? 100 : 300)
    : null;

  return (
    <div className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-900">{note.item.title}</h3>
          {note._pending && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
              <Clock className="w-3 h-3 mr-0.5" />
              Pending
            </span>
          )}
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <Calendar className="w-4 h-4 mr-1" />
          <span>{format(new Date(note.item.created_at), 'MMM d, yyyy')}</span>
        </div>
      </div>
      
      {contentPreview && (
        <div className="mt-2">
          <div className="flex items-start space-x-2">
            <FileText className="w-4 h-4 mt-1 flex-shrink-0 text-gray-400" />
            <p className="text-sm text-gray-600 whitespace-pre-line">
              {contentPreview}
            </p>
          </div>
        </div>
      )}
      
      {!preview && note.content && note.content.length > 300 && (
        <button className="mt-2 text-sm text-blue-600 hover:text-blue-700">
          Read more
        </button>
      )}
    </div>
  );
});

NoteCard.displayName = 'NoteCard';