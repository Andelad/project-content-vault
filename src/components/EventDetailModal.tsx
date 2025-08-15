import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { CalendarEvent } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Calendar, Clock, Repeat, Trash2, CheckCircle2 } from 'lucide-react';
import { Switch } from './ui/switch';
import { cn } from '@/lib/utils';

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId?: string;
  defaultStartTime?: Date;
  defaultEndTime?: Date;
}

export function EventDetailModal({ 
  isOpen, 
  onClose, 
  eventId,
  defaultStartTime,
  defaultEndTime
}: EventDetailModalProps) {
  const { 
    events, 
    projects, 
    groups, 
    addEvent, 
    updateEvent,
    deleteEvent 
  } = useApp();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    projectId: '',
    color: '#6b7280',
    completed: false,
    isRecurring: false,
    recurringType: 'weekly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    recurringInterval: 1,
    recurringEndType: 'never' as 'never' | 'date' | 'count',
    recurringEndDate: '',
    recurringCount: 10
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!eventId;
  const existingEvent = isEditing ? events.find(e => e.id === eventId) : null;

  // Format date for date input (YYYY-MM-DD)
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Format time for time input (HH:MM)
  const formatTime = (date: Date) => {
    return date.toTimeString().slice(0, 5);
  };

  // Parse form data into Date objects
  const getStartDateTime = () => {
    const date = new Date(`${formData.startDate}T${formData.startTime}`);
    return date;
  };

  const getEndDateTime = () => {
    const date = new Date(`${formData.endDate}T${formData.endTime}`);
    return date;
  };

  // Initialize form data
  useEffect(() => {
    if (isOpen) {
      if (existingEvent) {
        setFormData({
          title: existingEvent.title,
          description: existingEvent.description || '',
          startDate: formatDate(new Date(existingEvent.startTime)),
          startTime: formatTime(new Date(existingEvent.startTime)),
          endDate: formatDate(new Date(existingEvent.endTime)),
          endTime: formatTime(new Date(existingEvent.endTime)),
          projectId: existingEvent.projectId || '',
          color: existingEvent.color || '#6b7280',
          completed: existingEvent.completed || false,
          isRecurring: !!existingEvent.recurring,
          recurringType: existingEvent.recurring?.type || 'weekly',
          recurringInterval: existingEvent.recurring?.interval || 1,
          recurringEndType: existingEvent.recurring?.endDate ? 'date' : existingEvent.recurring?.count ? 'count' : 'never',
          recurringEndDate: existingEvent.recurring?.endDate ? formatDate(existingEvent.recurring.endDate) : '',
          recurringCount: existingEvent.recurring?.count || 10
        });
      } else {
        // Reset for new event
        const startDate = defaultStartTime || new Date();
        const endDate = defaultEndTime || new Date(startDate.getTime() + 60 * 60 * 1000);
        setFormData({
          title: '',
          description: '',
          startDate: formatDate(startDate),
          startTime: formatTime(startDate),
          endDate: formatDate(endDate),
          endTime: formatTime(endDate),
          projectId: '',
          color: '#6b7280',
          completed: false,
          isRecurring: false,
          recurringType: 'weekly',
          recurringInterval: 1,
          recurringEndType: 'never',
          recurringEndDate: '',
          recurringCount: 10
        });
      }
      setErrors({});
    }
  }, [isOpen, existingEvent, defaultStartTime, defaultEndTime]);

  // Update color when project changes
  useEffect(() => {
    if (formData.projectId) {
      const selectedProject = projects.find(p => p.id === formData.projectId);
      if (selectedProject) {
        setFormData(prev => ({ ...prev, color: selectedProject.color }));
      }
    }
  }, [formData.projectId, projects]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.startDate || !formData.startTime) {
      newErrors.startDateTime = 'Start date and time are required';
    }

    if (!formData.endDate || !formData.endTime) {
      newErrors.endDateTime = 'End date and time are required';
    }

    if (formData.startDate && formData.startTime && formData.endDate && formData.endTime) {
      const startDateTime = getStartDateTime();
      const endDateTime = getEndDateTime();

      if (startDateTime >= endDateTime) {
        newErrors.endDateTime = 'End time must be after start time';
      }
    }

    if (formData.isRecurring && formData.recurringEndType === 'date' && !formData.recurringEndDate) {
      newErrors.recurringEndDate = 'End date is required for recurring events';
    }

    if (formData.isRecurring && formData.recurringInterval < 1) {
      newErrors.recurringInterval = 'Interval must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const startDateTime = getStartDateTime();
      const endDateTime = getEndDateTime();
      const duration = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
      
      const eventData: Omit<CalendarEvent, 'id'> = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        startTime: startDateTime,
        endTime: endDateTime,
        duration,
        projectId: formData.projectId || undefined,
        color: formData.color,
        completed: formData.completed
      };

      // Add recurring data if enabled
      if (formData.isRecurring) {
        eventData.recurring = {
          type: formData.recurringType,
          interval: formData.recurringInterval,
          ...(formData.recurringEndType === 'date' && formData.recurringEndDate && {
            endDate: new Date(formData.recurringEndDate)
          }),
          ...(formData.recurringEndType === 'count' && {
            count: formData.recurringCount
          })
        };
      }

      if (isEditing && existingEvent) {
        await updateEvent(existingEvent.id, eventData);
      } else {
        await addEvent(eventData);
      }

      onClose();
    } catch (error) {
      console.error('Failed to save event:', error);
      setErrors({ submit: 'Failed to save event. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingEvent) return;

    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteEvent(existingEvent.id);
        onClose();
      } catch (error) {
        console.error('Failed to delete event:', error);
        setErrors({ submit: 'Failed to delete event. Please try again.' });
      }
    }
  };

  const selectedProject = formData.projectId ? projects.find(p => p.id === formData.projectId) : null;

  // Group projects by group for better organization
  const projectsByGroup = projects.reduce((acc, project) => {
    const group = groups.find(g => g.id === project.groupId);
    const groupName = group?.name || 'Ungrouped';
    
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(project);
    return acc;
  }, {} as Record<string, typeof projects>);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {isEditing ? 'Edit Event' : 'Create Event'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Edit the details of the event' : 'Create a new event'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter event title"
              className={errors.title ? 'border-destructive' : ''}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Date and Time Range */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className={errors.startDateTime ? 'border-destructive' : ''}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  className={errors.startDateTime ? 'border-destructive' : ''}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  className={errors.endDateTime ? 'border-destructive' : ''}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  className={errors.endDateTime ? 'border-destructive' : ''}
                />
              </div>
            </div>
            
            {(errors.startDateTime || errors.endDateTime) && (
              <p className="text-sm text-destructive">
                {errors.startDateTime || errors.endDateTime}
              </p>
            )}
          </div>

          {/* Duration Display */}
          {formData.startDate && formData.startTime && formData.endDate && formData.endTime && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>
                Duration: {((getEndDateTime().getTime() - getStartDateTime().getTime()) / (1000 * 60 * 60)).toFixed(1)} hours
              </span>
            </div>
          )}

          {/* Project Selection */}
          <div className="space-y-2">
            <Label htmlFor="project">Project (Optional)</Label>
            <Select value={formData.projectId} onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No project</SelectItem>
                {Object.entries(projectsByGroup).map(([groupName, groupProjects]) => (
                  <div key={groupName}>
                    <div className="px-2 py-1 text-sm font-semibold text-muted-foreground">
                      {groupName}
                    </div>
                    {groupProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full border border-gray-300"
                            style={{ backgroundColor: project.color }}
                          />
                          <span>{project.name}</span>
                          <span className="text-xs text-muted-foreground">({project.client})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {selectedProject && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div 
                  className="w-3 h-3 rounded-full border border-gray-300"
                  style={{ backgroundColor: selectedProject.color }}
                />
                <span>Event will use project color: {selectedProject.name}</span>
              </div>
            )}
          </div>

          {/* Completed Status */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="completed"
              checked={formData.completed}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, completed: !!checked }))}
            />
            <Label htmlFor="completed" className="flex items-center gap-2 cursor-pointer">
              <CheckCircle2 className="w-4 h-4" />
              Mark as completed
            </Label>
          </div>

          {/* Recurring Options */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="recurring"
                checked={formData.isRecurring}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isRecurring: checked }))}
              />
              <Label htmlFor="recurring" className="flex items-center gap-2 cursor-pointer">
                <Repeat className="w-4 h-4" />
                Make this a recurring event
              </Label>
            </div>

            {formData.isRecurring && (
              <div className="pl-6 space-y-4 border-l-2 border-muted">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="recurringType">Repeat</Label>
                    <Select value={formData.recurringType} onValueChange={(value: any) => setFormData(prev => ({ ...prev, recurringType: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="recurringInterval">Every</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="recurringInterval"
                        type="number"
                        min="1"
                        value={formData.recurringInterval}
                        onChange={(e) => setFormData(prev => ({ ...prev, recurringInterval: parseInt(e.target.value) || 1 }))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData.recurringType}(s)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>End recurring</Label>
                  <Select value={formData.recurringEndType} onValueChange={(value: any) => setFormData(prev => ({ ...prev, recurringEndType: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="date">On date</SelectItem>
                      <SelectItem value="count">After number of occurrences</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.recurringEndType === 'date' && (
                  <div className="space-y-2">
                    <Label htmlFor="recurringEndDate">End date</Label>
                    <Input
                      id="recurringEndDate"
                      type="date"
                      value={formData.recurringEndDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, recurringEndDate: e.target.value }))}
                      className={errors.recurringEndDate ? 'border-destructive' : ''}
                    />
                    {errors.recurringEndDate && (
                      <p className="text-sm text-destructive">{errors.recurringEndDate}</p>
                    )}
                  </div>
                )}

                {formData.recurringEndType === 'count' && (
                  <div className="space-y-2">
                    <Label htmlFor="recurringCount">Number of occurrences</Label>
                    <Input
                      id="recurringCount"
                      type="number"
                      min="1"
                      value={formData.recurringCount}
                      onChange={(e) => setFormData(prev => ({ ...prev, recurringCount: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter event description (optional)"
              rows={4}
            />
          </div>

          {/* Error Messages */}
          {errors.submit && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {errors.submit}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <div>
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Event
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : (isEditing ? 'Update Event' : 'Create Event')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}