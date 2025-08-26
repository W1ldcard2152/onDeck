'use client'

import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  value?: string; // Format: "HH:MM" (24-hour format)
  onChange?: (value: string) => void;
  className?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  value = "",
  onChange,
  className
}) => {
  const [hour12, setHour12] = useState(12);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const [isOpen, setIsOpen] = useState(false);

  // Parse the 24-hour format time value into 12-hour components
  useEffect(() => {
    if (value && value.includes(':')) {
      const [hourStr, minuteStr] = value.split(':');
      const hour24 = parseInt(hourStr, 10);
      const min = parseInt(minuteStr, 10);
      
      if (hour24 === 0) {
        setHour12(12);
        setPeriod('AM');
      } else if (hour24 < 12) {
        setHour12(hour24);
        setPeriod('AM');
      } else if (hour24 === 12) {
        setHour12(12);
        setPeriod('PM');
      } else {
        setHour12(hour24 - 12);
        setPeriod('PM');
      }
      
      setMinute(min);
    }
  }, [value]);

  // Convert 12-hour format back to 24-hour format and call onChange
  const updateTime = (newHour12: number, newMinute: number, newPeriod: 'AM' | 'PM') => {
    let hour24 = newHour12;
    if (newPeriod === 'AM' && newHour12 === 12) {
      hour24 = 0;
    } else if (newPeriod === 'PM' && newHour12 !== 12) {
      hour24 = newHour12 + 12;
    }
    
    const timeString = `${hour24.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`;
    onChange?.(timeString);
  };

  const adjustHour = (direction: 'up' | 'down') => {
    let newHour = hour12;
    if (direction === 'up') {
      newHour = hour12 === 12 ? 1 : hour12 + 1;
    } else {
      newHour = hour12 === 1 ? 12 : hour12 - 1;
    }
    setHour12(newHour);
    updateTime(newHour, minute, period);
  };

  const adjustMinute = (direction: 'up' | 'down') => {
    let newMinute = minute;
    if (direction === 'up') {
      newMinute = minute === 59 ? 0 : minute + 1;
    } else {
      newMinute = minute === 0 ? 59 : minute - 1;
    }
    setMinute(newMinute);
    updateTime(hour12, newMinute, period);
  };

  const togglePeriod = () => {
    const newPeriod = period === 'AM' ? 'PM' : 'AM';
    setPeriod(newPeriod);
    updateTime(hour12, minute, newPeriod);
  };

  const formatDisplayTime = () => {
    if (!value) return 'Select time';
    const hour = hour12;
    const min = minute.toString().padStart(2, '0');
    return `${hour}:${min} ${period}`;
  };

  const TimeSlider = ({ 
    label, 
    value: sliderValue, 
    onUp, 
    onDown,
    displayValue
  }: {
    label: string;
    value: number;
    onUp: () => void;
    onDown: () => void;
    displayValue?: string;
  }) => (
    <div className="flex flex-col items-center space-y-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-blue-50"
        onClick={onUp}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      
      <div className="text-center">
        <div className="text-2xl font-mono font-semibold w-12 h-12 flex items-center justify-center bg-gray-50 rounded-lg border">
          {displayValue || sliderValue.toString().padStart(2, '0')}
        </div>
      </div>
      
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-blue-50"
        onClick={onDown}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  );

  const AmPmSlider = () => (
    <div className="flex flex-col items-center space-y-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-blue-50"
        onClick={togglePeriod}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      
      <div className="text-center">
        <button
          type="button"
          onClick={togglePeriod}
          className="text-lg font-semibold w-12 h-12 flex items-center justify-center bg-blue-500 text-white rounded-lg border hover:bg-blue-600 transition-colors"
        >
          {period}
        </button>
      </div>
      
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-blue-50"
        onClick={togglePeriod}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className={cn("space-y-2", className)}>
      {/* Display/Trigger Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start text-left font-normal"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Clock className="mr-2 h-4 w-4" />
        {formatDisplayTime()}
      </Button>

      {/* Time Picker Interface */}
      {isOpen && (
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <div className="flex justify-center items-center space-x-8">
            {/* Hour Slider */}
            <TimeSlider
              label="Hour"
              value={hour12}
              onUp={() => adjustHour('up')}
              onDown={() => adjustHour('down')}
              displayValue={hour12.toString()}
            />

            {/* Colon Separator */}
            <div className="text-2xl font-bold text-gray-400 mt-8">:</div>

            {/* Minute Slider */}
            <TimeSlider
              label="Min"
              value={minute}
              onUp={() => adjustMinute('up')}
              onDown={() => adjustMinute('down')}
            />

            {/* AM/PM Slider */}
            <AmPmSlider />
          </div>

          {/* Close Button */}
          <div className="flex justify-center mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};