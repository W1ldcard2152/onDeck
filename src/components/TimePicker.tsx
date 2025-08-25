'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock } from 'lucide-react';

interface TimePickerProps {
  value: string; // HH:MM format
  onChange: (time: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = "Set time"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Parse current time
  const [hours, minutes] = value ? value.split(':').map(Number) : [12, 0];
  const is12Hour = true; // Use 12-hour format for easier selection
  const displayHours = is12Hour ? (hours === 0 ? 12 : hours > 12 ? hours - 12 : hours) : hours;
  const period = hours >= 12 ? 'PM' : 'AM';

  // Generate hour and minute options
  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10, 15, etc.

  const handleTimeSelect = (newHours: number, newMinutes: number, newPeriod: string) => {
    // Convert to 24-hour format
    let hour24 = newHours;
    if (newPeriod === 'PM' && newHours !== 12) {
      hour24 = newHours + 12;
    } else if (newPeriod === 'AM' && newHours === 12) {
      hour24 = 0;
    }
    
    const timeString = `${hour24.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    onChange(timeString);
    setIsOpen(false);
  };

  const formatDisplayTime = (time: string) => {
    if (!time) return placeholder;
    const [h, m] = time.split(':').map(Number);
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const period = h >= 12 ? 'PM' : 'AM';
    return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={`w-full justify-start text-left font-normal ${
            !value && 'text-muted-foreground'
          }`}
        >
          <Clock className="mr-2 h-4 w-4" />
          {formatDisplayTime(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="p-4">
          <div className="text-sm font-medium mb-3">Select Time</div>
          
          {/* Time Display */}
          <div className="text-center mb-4">
            <div className="text-2xl font-mono">
              {displayHours}:{minutes.toString().padStart(2, '0')} {period}
            </div>
          </div>
          
          {/* Hour Selection */}
          <div className="mb-4">
            <div className="text-xs font-medium mb-2 text-gray-600">Hour</div>
            <div className="grid grid-cols-6 gap-1">
              {hourOptions.map((hour) => (
                <Button
                  key={hour}
                  variant={displayHours === hour ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleTimeSelect(hour, minutes, period)}
                >
                  {hour}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Minute Selection */}
          <div className="mb-4">
            <div className="text-xs font-medium mb-2 text-gray-600">Minutes</div>
            <div className="grid grid-cols-6 gap-1">
              {minuteOptions.map((minute) => (
                <Button
                  key={minute}
                  variant={minutes === minute ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleTimeSelect(displayHours, minute, period)}
                >
                  {minute.toString().padStart(2, '0')}
                </Button>
              ))}
            </div>
          </div>
          
          {/* AM/PM Selection */}
          <div className="mb-4">
            <div className="text-xs font-medium mb-2 text-gray-600">Period</div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={period === 'AM' ? "default" : "outline"}
                size="sm"
                onClick={() => handleTimeSelect(displayHours, minutes, 'AM')}
              >
                AM
              </Button>
              <Button
                variant={period === 'PM' ? "default" : "outline"}
                size="sm"
                onClick={() => handleTimeSelect(displayHours, minutes, 'PM')}
              >
                PM
              </Button>
            </div>
          </div>
          
          {/* Quick Time Buttons */}
          <div className="border-t pt-3">
            <div className="text-xs font-medium mb-2 text-gray-600">Quick Select</div>
            <div className="grid grid-cols-4 gap-1">
              {[
                { label: '9 AM', time: '09:00' },
                { label: '12 PM', time: '12:00' },
                { label: '3 PM', time: '15:00' },
                { label: '6 PM', time: '18:00' },
              ].map((quick) => (
                <Button
                  key={quick.time}
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    onChange(quick.time);
                    setIsOpen(false);
                  }}
                >
                  {quick.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};