import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { StandardModal } from '../modals/StandardModal';
import { WorkHour } from '../../types/core';
import { calculateDurationHours } from '../../services/work-hours';

interface WorkHourCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (workHour: Omit<WorkHour, 'id'>) => void;
  defaultStart: Date;
  defaultEnd: Date;
}

export function WorkHourCreationModal({
  isOpen,
  onClose,
  onSave,
  defaultStart,
  defaultEnd,
}: WorkHourCreationModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(
    defaultStart.toISOString().slice(0, 16)
  );
  const [endTime, setEndTime] = useState(
    defaultEnd.toISOString().slice(0, 16)
  );

  const handleSave = () => {
    if (!title.trim()) return;

    const workHour: Omit<WorkHour, 'id'> = {
      title: title.trim(),
      description: description.trim(),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      duration: calculateDurationHours(new Date(startTime), new Date(endTime)),
      type: 'work'
    };

    onSave(workHour);
    
    // Reset form
    setTitle('');
    setDescription('');
    setStartTime(defaultStart.toISOString().slice(0, 16));
    setEndTime(defaultEnd.toISOString().slice(0, 16));
  };

  const handleClose = () => {
    // Reset form on close
    setTitle('');
    setDescription('');
    setStartTime(defaultStart.toISOString().slice(0, 16));
    setEndTime(defaultEnd.toISOString().slice(0, 16));
    onClose();
  };

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Work Hour Block"
      size="md"
      primaryAction={{
        label: 'Create Work Hour',
        onClick: handleSave,
        disabled: !title.trim()
      }}
      secondaryAction={{
        label: 'Cancel',
        onClick: handleClose
      }}
    >
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Focus Time, Meeting Block"
            className="w-full"
          />
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="w-full"
            rows={3}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="start">Start Time</Label>
            <Input
              id="start"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="end">End Time</Label>
            <Input
              id="end"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </StandardModal>
  );
}
