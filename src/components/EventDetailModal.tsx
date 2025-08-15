import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { CalendarEvent } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Calendar, Clock, Tag, X, Palette, CheckCircle2 } from 'lucide-react';

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
    startTime: defaultStartTime || new Date(),
    endTime: defaultEndTime || new Date(Date.now() + 60 * 60 * 1000), // 1 hour default
    projectId: '',
    color: '#6b7280', // Default gray color
    completed: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!eventId;
  const existingEvent = isEditing ? events.find(e => e.id === eventId) : null;

  // Initialize form data
  useEffect(() => {
    if (isOpen) {
      if (existingEvent) {
        setFormData({
          title: existingEvent.title,
          description: existingEvent.description || '',
          startTime: existingEvent.startTime,
          endTime: existingEvent.endTime,
          projectId: existingEvent.projectId || 'none',
          color: existingEvent.color || '#6b7280',
          completed: existingEvent.completed || false
        });
      } else {
        // Reset for new event
        const now = defaultStartTime || new Date();
        const endTime = defaultEndTime || new Date(now.getTime() + 60 * 60 * 1000);
        setFormData({
          title: '',
          description: '',
          startTime: now,
          endTime: endTime,
          projectId: 'none',
          color: '#6b7280',
          completed: false
        });
      }
      setErrors({});
    }
  }, [isOpen, existingEvent, defaultStartTime, defaultEndTime]);

  // Update color when project changes
  useEffect(() => {
    if (formData.projectId && formData.projectId !== 'none') {
      const selectedProject = projects.find(p => p.id === formData.projectId);
      if (selectedProject) {
        setFormData(prev => ({ ...prev, color: selectedProject.color }));
      }
    }
  }, [formData.projectId, projects]);

  const formatDateTime = (date: Date) => {
    return date.toISOString().slice(0, 16); // Format for datetime-local input
  };

  const parseDateTime = (dateTimeString: string) => {
    return new Date(dateTimeString);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time';
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
      const duration = (formData.endTime.getTime() - formData.startTime.getTime()) / (1000 * 60 * 60);
      
      const eventData: Omit<CalendarEvent, 'id'> = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        startTime: formData.startTime,
        endTime: formData.endTime,
        duration,
        projectId: formData.projectId && formData.projectId !== 'none' ? formData.projectId : undefined,
        color: formData.color,
        completed: formData.completed
      };

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

  const selectedProject = formData.projectId && formData.projectId !== 'none' ? projects.find(p => p.id === formData.projectId) : null;
  const selectedGroup = selectedProject ? groups.find(g => g.id === selectedProject.groupId) : null;

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

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={formatDateTime(formData.startTime)}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  startTime: parseDateTime(e.target.value) 
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={formatDateTime(formData.endTime)}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  endTime: parseDateTime(e.target.value) 
                }))}
                className={errors.endTime ? 'border-destructive' : ''}
              />
              {errors.endTime && (
                <p className="text-sm text-destructive">{errors.endTime}</p>
              )}
            </div>
          </div>

          {/* Duration Display */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>
              Duration: {((formData.endTime.getTime() - formData.startTime.getTime()) / (1000 * 60 * 60)).toFixed(1)} hours
            </span>
          </div>

          {/* Project Selection */}
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select
              value={formData.projectId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project (optional)">
                  {selectedProject && (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: selectedProject.color }}
                      />
                      <span className="truncate">{selectedProject.name}</span>
                      {selectedGroup && (
                        <Badge variant="secondary" className="text-xs">
                          {selectedGroup.name}
                        </Badge>
                      )}
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="none">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-gray-400" />
                    <span>No project</span>
                  </div>
                </SelectItem>
                {Object.entries(projectsByGroup).map(([groupName, groupProjects]) => (
                  <div key={groupName}>
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t">
                      {groupName}
                    </div>
                    {groupProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="truncate">{project.name}</span>
                          <span className="text-xs text-muted-foreground">
                            • {project.client}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color Preview */}
          {formData.color && (
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              <span className="text-sm text-muted-foreground">Event color:</span>
              <div 
                className="w-6 h-6 rounded border"
                style={{ backgroundColor: formData.color }}
              />
              {selectedProject && (
                <span className="text-sm text-muted-foreground">
                  (inherited from {selectedProject.name})
                </span>
              )}
            </div>
          )}

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

          {/* Error Message */}
          {errors.submit && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
              <p className="text-sm text-destructive">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <div>
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                >
                  Delete Event
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : isEditing ? 'Update Event' : 'Create Event'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}