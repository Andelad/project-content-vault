import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useApp } from '../contexts/AppContext';

interface HolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  holidayId?: string;
}

export function HolidayModal({ isOpen, onClose, holidayId }: HolidayModalProps) {
  const { holidays, addHoliday, updateHoliday, deleteHoliday } = useApp();
  
  // Find the holiday if editing
  const existingHoliday = holidayId ? holidays.find(h => h.id === holidayId) : null;
  const isEditing = !!existingHoliday;

  // Form state
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [notes, setNotes] = useState('');

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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setStartDate(today);
      setEndDate(today);
      setNotes('');
    }
  }, [isEditing, existingHoliday, isOpen]);

  const handleSave = () => {
    if (!title.trim() || !startDate || !endDate) return;

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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0">
        <div className="p-[21px]">
          <DialogHeader className="mb-[21px]">
            <DialogTitle className="text-xl">
              {isEditing ? 'Edit Holiday' : 'Add Holiday'}
            </DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update your holiday details below.' : 'Create a new holiday with a title, date range, and optional notes.'}
            </DialogDescription>
          </DialogHeader>

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
                <Label htmlFor="start-date">From</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate ? startDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const date = new Date(e.target.value + 'T00:00:00');
                      setStartDate(date);
                    }
                  }}
                />
              </div>

              {/* To Date */}
              <div className="space-y-2">
                <Label htmlFor="end-date">To</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate ? endDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const date = new Date(e.target.value + 'T00:00:00');
                      setEndDate(date);
                    }
                  }}
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
        </div>

        {/* Bottom Action Buttons */}
        <div className="border-t bg-gray-50 px-6 py-4 flex justify-between">
          <div>
            {isEditing && (
              <Button
                variant="outline"
                onClick={handleDelete}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                Delete Holiday
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim() || !startDate || !endDate}
              className="bg-[#02c0b7] hover:bg-[#02c0b7]/90 text-white"
            >
              {isEditing ? 'Update Holiday' : 'Add Holiday'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}