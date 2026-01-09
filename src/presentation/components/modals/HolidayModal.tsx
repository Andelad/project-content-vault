import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { Label } from '../shadcn/label';
import { Textarea } from '../shadcn/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '../shadcn/popover';
import { Calendar } from '../shadcn/calendar';
import { useHolidays } from '@/presentation/hooks/data/useHolidays';
import { StandardModal } from './StandardModal';
import { HolidayOrchestrator } from '@/application/orchestrators/HolidayOrchestrator';

interface HolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  holidayId?: string;
  defaultStartDate?: Date;
  defaultEndDate?: Date;
}

export function HolidayModal({ isOpen, onClose, holidayId, defaultStartDate, defaultEndDate }: HolidayModalProps) {
  const { holidays, addHoliday, updateHoliday, deleteHoliday } = useHolidays();
  
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

  const handleSave = async () => {
    if (!title.trim() || !startDate || !endDate) return;

    // Delegate to HolidayOrchestrator (AI Rule: use existing orchestrator)
    const orchestrator = new HolidayOrchestrator(holidays, holidayId);
    
    const formData = {
      title: title.trim(),
      startDate,
      endDate,
      notes: notes.trim()
    };

    if (isEditing && holidayId) {
      // Handle editing workflow
      const result = await orchestrator.updateHolidayWorkflow(
        formData,
        holidayId,
        (id, holidayData) => updateHoliday(id, holidayData)
      );

      if (result.success) {
        onClose();
      } else if (result.needsUserConfirmation && result.adjustedDates) {
        // Update form with adjusted dates and show message
        setStartDate(result.adjustedDates.startDate);
        setEndDate(result.adjustedDates.endDate);
        alert(`❌ Holiday overlap detected!\n\n✅ Auto-fixed: ${result.adjustedDates.message}\n\nYou can now save or make further adjustments.`);
      } else if (result.error) {
        alert(`❌ ${result.error}`);
      }
    } else {
      // Handle creation workflow
      const result = await orchestrator.createHolidayWorkflow(
        formData,
        addHoliday
      );

      if (result.success) {
        onClose();
      } else if (result.needsUserConfirmation && result.adjustedDates) {
        // Update form with adjusted dates and show message
        setStartDate(result.adjustedDates.startDate);
        setEndDate(result.adjustedDates.endDate);
        alert(`❌ Holiday overlap detected!\n\n✅ Auto-fixed: ${result.adjustedDates.message}\n\nYou can now save or make further adjustments.`);
      } else if (result.error) {
        alert(`❌ ${result.error}`);
      }
    }
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