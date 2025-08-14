import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppActions } from '@/contexts/AppActionsContext';
import { Plus, Clock } from 'lucide-react';

interface TimeSlotFormProps {
  selectedDate: Date;
}

export const TimeSlotForm: React.FC<TimeSlotFormProps> = ({ selectedDate }) => {
  const { addTimeSlot } = useAppActions();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    isAvailable: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.startTime || !formData.endTime) {
      return;
    }

    addTimeSlot({
      title: formData.title || 'Untitled Event',
      description: formData.description,
      startTime: formData.startTime,
      endTime: formData.endTime,
      date: selectedDate.toISOString().split('T')[0],
      isAvailable: formData.isAvailable,
    });

    // Reset form
    setFormData({
      title: '',
      description: '',
      startTime: '',
      endTime: '',
      isAvailable: true,
    });
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Plus className="h-5 w-5 text-primary" />
          Add Time Slot
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-foreground">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter event title..."
              className="bg-background border-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter event description..."
              className="bg-background border-input resize-none"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime" className="text-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Start Time
              </Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => handleChange('startTime', e.target.value)}
                className="bg-background border-input"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime" className="text-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                End Time
              </Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => handleChange('endTime', e.target.value)}
                className="bg-background border-input"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="isAvailable" className="text-foreground font-medium">
                Available for booking
              </Label>
              <p className="text-xs text-muted-foreground">
                Mark this time slot as available for others to book
              </p>
            </div>
            <Switch
              id="isAvailable"
              checked={formData.isAvailable}
              onCheckedChange={(checked) => handleChange('isAvailable', checked)}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Time Slot
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};