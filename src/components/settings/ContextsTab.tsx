'use client'

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { GripVertical, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useContexts } from '@/hooks/useContexts';
import { CONTEXT_COLORS, type Context, type ContextColor } from '@/lib/types';
import { contextColorToBadgeClasses } from '@/lib/dashboardUtils';

// ── Color picker ─────────────────────────────────────────────────────────────

const COLOR_LABELS: Record<ContextColor, string> = {
  orange: 'Orange', red: 'Red', green: 'Green', purple: 'Purple',
  blue: 'Blue', yellow: 'Yellow', pink: 'Pink', sky: 'Sky',
  indigo: 'Indigo', teal: 'Teal',
};

const DOT_CLASSES: Record<ContextColor, string> = {
  orange: 'bg-orange-400', red: 'bg-red-400', green: 'bg-green-500',
  purple: 'bg-purple-400', blue: 'bg-blue-400', yellow: 'bg-yellow-400',
  pink: 'bg-pink-400', sky: 'bg-sky-400', indigo: 'bg-indigo-400', teal: 'bg-teal-400',
};

function ColorPicker({ value, onChange }: { value: ContextColor; onChange: (c: ContextColor) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CONTEXT_COLORS.map(color => (
        <button
          key={color}
          type="button"
          title={COLOR_LABELS[color]}
          onClick={() => onChange(color)}
          className={`w-6 h-6 rounded-full ${DOT_CLASSES[color]} ring-offset-1 ${
            value === color ? 'ring-2 ring-gray-700' : 'hover:ring-2 hover:ring-gray-400'
          }`}
        />
      ))}
    </div>
  );
}

// ── Inline add / edit form ────────────────────────────────────────────────────

interface ContextFormProps {
  initial?: { name: string; emoji: string; color: ContextColor };
  onSave: (name: string, emoji: string, color: ContextColor) => Promise<void>;
  onCancel: () => void;
}

function ContextForm({ initial, onSave, onCancel }: ContextFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '📌');
  const [color, setColor] = useState<ContextColor>(initial?.color ?? 'blue');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    await onSave(name.trim(), emoji, color);
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg border bg-gray-50">
      <div className="flex items-center gap-3">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-2xl leading-none w-10 h-10 flex items-center justify-center rounded-lg border bg-white hover:bg-gray-50 shrink-0"
            >
              {emoji}
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-auto border-0" align="start">
            <EmojiPicker
              onEmojiClick={(data: EmojiClickData) => { setEmoji(data.emoji); setPickerOpen(false); }}
              lazyLoadEmojis
            />
          </PopoverContent>
        </Popover>

        <Input
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          placeholder="Context name"
          className="flex-1"
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          autoFocus
        />
      </div>

      <ColorPicker value={color} onChange={setColor} />

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Preview:</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${contextColorToBadgeClasses(color)}`}>
          {emoji} {name || 'Context name'}
        </span>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Check className="h-4 w-4 mr-1" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Sortable row ──────────────────────────────────────────────────────────────

interface ContextRowProps {
  context: Context;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableContextRow({ context, onEdit, onDelete }: ContextRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: context.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-white"
    >
      <button
        type="button"
        className="cursor-grab text-gray-300 hover:text-gray-500 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <span className={`px-3 py-1 rounded-full text-sm font-medium ${contextColorToBadgeClasses(context.color)}`}>
        {context.emoji} {context.name}
      </span>

      <div className="ml-auto flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
          <Pencil className="h-4 w-4 text-gray-500" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-red-400" />
        </Button>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function ContextsTab() {
  const { contexts, loading, addContext, updateContext, deleteContext, reorderContexts, getTaskCount } =
    useContexts();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = contexts.findIndex(c => c.id === active.id);
    const newIndex = contexts.findIndex(c => c.id === over.id);
    reorderContexts(arrayMove(contexts, oldIndex, newIndex));
  };

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    const count = await getTaskCount(id);
    if (count > 0) {
      const ctx = contexts.find(c => c.id === id);
      setDeleteError(
        `Cannot delete "${ctx?.name}" — ${count} task${count === 1 ? ' uses' : 's use'} this context. Reassign or complete those tasks first.`
      );
      return;
    }
    await deleteContext(id);
  };

  if (loading) {
    return <div className="text-sm text-gray-500 py-4">Loading contexts…</div>;
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Daily Contexts</h2>
        <p className="text-sm text-gray-500">
          Contexts group tasks by time of day. Drag to reorder — order determines the flow on the Dashboard.
        </p>
      </div>

      {deleteError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={contexts.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {contexts.map(context =>
              editingId === context.id ? (
                <ContextForm
                  key={context.id}
                  initial={{ name: context.name, emoji: context.emoji, color: context.color }}
                  onSave={async (name, emoji, color) => {
                    await updateContext(context.id, { name, emoji, color });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <SortableContextRow
                  key={context.id}
                  context={context}
                  onEdit={() => { setAdding(false); setEditingId(context.id); setDeleteError(null); }}
                  onDelete={() => handleDelete(context.id)}
                />
              )
            )}
          </div>
        </SortableContext>
      </DndContext>

      {adding ? (
        <ContextForm
          onSave={async (name, emoji, color) => {
            await addContext(name, emoji, color);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setAdding(true); setEditingId(null); setDeleteError(null); }}
        >
          <Plus className="h-4 w-4 mr-2" /> Add Context
        </Button>
      )}
    </div>
  );
}
