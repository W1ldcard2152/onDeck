'use client'

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DashboardTaskItem } from './DashboardTaskItem';

type DashboardTaskItemProps = React.ComponentProps<typeof DashboardTaskItem>;

export const SortableDashboardTaskItem: React.FC<DashboardTaskItemProps> = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <DashboardTaskItem
        {...props}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
};
