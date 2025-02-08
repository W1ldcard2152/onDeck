import React from 'react';
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TruncatedCellProps {
  content: string | null;
  maxLength?: number;
}

const TruncatedCell: React.FC<TruncatedCellProps> = ({ content, maxLength = 60 }) => {
  // If the content is empty or null, return a dash
  if (!content) {
    return <span>-</span>;
  }

  // If content is shorter than maxLength, just return it
  if (content.length <= maxLength) {
    return <span>{content}</span>;
  }

  const truncatedContent = content.slice(0, maxLength) + '...';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span className="cursor-help border-b border-dotted border-gray-400 hover:border-gray-600">
          {truncatedContent}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 bg-white">
        <div 
          className={cn(
            "text-sm leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto",
            "scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
          )}
        >
          {content}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TruncatedCell;