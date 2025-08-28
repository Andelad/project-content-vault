import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { StandardModal } from './StandardModal';

interface HolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  holidayId?: string;
  defaultStartDate?: Date;
  defaultEndDate?: Date;
}

export function HolidayModal({ isOpen, onClose, holidayId, defaultStartDate, defaultEndDate }: HolidayModalProps) {
  const { holidays, addHoliday, updateHoliday, deleteHoliday } = usePlannerContext();
  
  // Find the holiday if editing
  const existingHoliday = holidayId ? holidays.find(h => h.id === holidayId) : null;
  const isEditing = !!existingHoliday;

  // Form state
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [notes, setNotes] = useState('');

  // Format date for display
  const formatDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  // Date picker component
  const DatePicker = ({ 
    value, 
    onSelect, 
    placeholder 
  }: { 
    value?: Date; 
    onSelect: (date: Date | undefined) => void; 
    placeholder: string;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? formatDate(value) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(selectedDate) => {
              onSelect(selectedDate);
              setIsOpen(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  };

  // Initialize form data
  useEffect(() => {
    if (isEditing && existingHoliday) {
      setTitle(existingHoliday.title);
      setStartDate(existingHoliday.startDate);
      setEndDate(existingHoliday.endDate);
      setNotes(existingHoliday.notes || '');
    } else {
      // Default values for new holiday
      setTitle('Holiday');
      
      // Use provided default dates or fallback to today
      if (defaultStartDate && defaultEndDate) {
        setStartDate(defaultStartDate);
        setEndDate(defaultEndDate);
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setStartDate(today);
        setEndDate(today);
      }
      
      setNotes('');
    }
  }, [isEditing, existingHoliday, isOpen, defaultStartDate, defaultEndDate]);

  const handleSave = () => {
    if (!title.trim() || !startDate || !endDate) return;

    // Validate dates
    if (startDate > endDate) {
      alert('❌ Invalid dates: Start date cannot be after end date.');
      return;
    }

    // Check for overlaps and auto-fix
    const overlappingHolidays = holidays.filter(existingHoliday => {
      // Skip the current holiday if editing
      if (isEditing && holidayId && existingHoliday.id === holidayId) return false;
      
      // Check if dates overlap
      const overlap = startDate <= existingHoliday.endDate && existingHoliday.startDate <= endDate;
      return overlap;
    });

    if (overlappingHolidays.length > 0) {
      const conflictList = overlappingHolidays
        .map(h => `• "${h.title}" (${h.startDate.toDateString()} - ${h.endDate.toDateString()})`)
        .join('\n');
      
      // Find which date needs adjustment and fix it
      let adjustedStartDate = new Date(startDate);
      let adjustedEndDate = new Date(endDate);
      let adjustmentMade = false;
      let adjustmentMessage = '';
      
      // Check if start date overlaps - move it after the conflicting holiday
      const startOverlap = overlappingHolidays.find(h => startDate <= h.endDate && startDate >= h.startDate);
      if (startOverlap) {
        adjustedStartDate = new Date(startOverlap.endDate);
        adjustedStartDate.setDate(adjustedStartDate.getDate() + 1);
        adjustmentMade = true;
        adjustmentMessage = `Start date moved to ${adjustedStartDate.toDateString()} (after "${startOverlap.title}")`;
      }
      
      // Check if end date overlaps - move it before the conflicting holiday
      const endOverlap = overlappingHolidays.find(h => endDate >= h.startDate && endDate <= h.endDate);
      if (endOverlap && !startOverlap) { // Only adjust end if we didn't already adjust start
        adjustedEndDate = new Date(endOverlap.startDate);
        adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);
        adjustmentMade = true;
        adjustmentMessage = `End date moved to ${adjustedEndDate.toDateString()} (before "${endOverlap.title}")`;
      }
      
      if (adjustmentMade) {
        // Update the form with adjusted dates
        setStartDate(adjustedStartDate);
        setEndDate(adjustedEndDate);
        
        alert(`❌ Holiday overlap detected!\n\nConflicting holidays:\n${conflictList}\n\n✅ Auto-fixed: ${adjustmentMessage}\n\nYou can now save or make further adjustments.`);
        return;
      }
    }

    const holidayData = {
      title: title.trim(),
      startDate,
      endDate,
      notes: notes.trim()
    };

    if (isEditing && holidayId) {
      updateHoliday(holidayId, holidayData);
    } else {
      addHoliday(holidayData);
    }

    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleDelete = () => {
    if (isEditing && holidayId) {
      deleteHoliday(holidayId);
      onClose();
    }
  };

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Holiday' : 'Add Holiday'}
      description={isEditing ? 'Update your holiday details below.' : 'Create a new holiday with a title, date range, and optional notes.'}
      size="md"
      primaryAction={{
        label: isEditing ? 'Update Holiday' : 'Add Holiday',
        onClick: handleSave,
        disabled: !title.trim() || !startDate || !endDate
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: handleCancel
      }}
      destructiveAction={isEditing ? {
        label: "Delete Holiday",
        onClick: handleDelete
      } : undefined}
    >
      {/* Yay message */}
      <div className="mb-[21px] text-center">
        <p className="text-base text-gray-600">🎉 Yay, let's take a break! 🏖️</p>
      </div>

      <div className="space-y-[21px]">
        {/* Title Field */}
        <div className="space-y-2">
          <Label htmlFor="holiday-title">Title</Label>
              <Input
                id="holiday-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter holiday title"
                autoFocus
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              {/* From Date */}
              <div className="space-y-2">
                <Label>From</Label>
                <DatePicker
                  value={startDate}
                  onSelect={setStartDate}
                  placeholder="Select start date"
                />
              </div>

              {/* To Date */}
              <div className="space-y-2">
                <Label>To</Label>
                <DatePicker
                  value={endDate}
                  onSelect={setEndDate}
                  placeholder="Select end date"
                />
              </div>
            </div>

            {/* Notes Field */}
            <div className="space-y-2">
              <Label htmlFor="holiday-notes">Notes</Label>
              <Textarea
                id="holiday-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this holiday..."
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
    </StandardModal>
  );
}