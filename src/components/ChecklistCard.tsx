'use client'

import React from 'react';
import { ChecklistTemplateWithDetails } from '@/types/checklist.types';
import { Flame, Edit, Trash2, CheckSquare, CheckCircle2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from 'lucide-react';

interface ChecklistCardProps {
  template: ChecklistTemplateWithDetails;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ChecklistCard({ template, onComplete, onEdit, onDelete }: ChecklistCardProps) {
  const contextColors: Record<string, string> = {
    Morning: 'bg-orange-100 text-orange-800',
    Work: 'bg-blue-100 text-blue-800',
    Family: 'bg-green-100 text-green-800',
    Evening: 'bg-purple-100 text-purple-800',
    Weekend: 'bg-pink-100 text-pink-800',
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer relative group"
      onClick={onComplete}
    >
      {/* Completed Today Indicator */}
      {template.completedToday && (
        <CheckCircle2 className="absolute top-3 right-10 h-5 w-5 text-green-500" />
      )}

      {/* Card Header */}
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-900 flex-1 pr-2">{template.name}</h3>

        {/* Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => e.stopPropagation()}
            className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="h-4 w-4 text-gray-500" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Context Badges */}
      {template.contexts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {template.contexts.map((ctx) => (
            <span
              key={ctx.id}
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                contextColors[ctx.context] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {ctx.context}
            </span>
          ))}
        </div>
      )}

      {/* Streak */}
      {template.streak !== undefined && template.streak > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <Flame className={`h-4 w-4 ${template.streak >= 7 ? 'text-orange-500' : 'text-gray-400'}`} />
          <span className="font-medium text-gray-700">
            {template.streak} day streak
          </span>
        </div>
      )}

      {/* Item count */}
      <div className="mt-3 text-sm text-gray-500 flex items-center gap-2">
        <CheckSquare className="h-4 w-4" />
        {template.items.length} {template.items.length === 1 ? 'item' : 'items'}
      </div>

      {/* Frequency indicator */}
      {template.recurrence_rule && (
        <div className="mt-2 text-xs text-gray-400">
          {getFrequencyDisplay(template.recurrence_rule.type)}
        </div>
      )}
    </div>
  );
}

function getFrequencyDisplay(type: string): string {
  switch (type) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    default:
      return '';
  }
}
