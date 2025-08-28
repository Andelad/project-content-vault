import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { WorkHour } from '../../types/core';

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
      duration: (new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60),
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Work Hour Block</DialogTitle>
        </DialogHeader>
        
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
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!title.trim()}
          >
            Create Work Hour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
