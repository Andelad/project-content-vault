import React, { useState, useEffect } from 'react';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { CalendarEvent } from '../../types';
import { calculateDurationHours, formatDuration } from '@/services';
import { eventModalOrchestrator, type EventFormData, type EventFormErrors } from '@/services/orchestrators/EventModalOrchestrator';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Calendar as CalendarIcon, Clock, Repeat, Trash2, CheckCircle2 } from 'lucide-react';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';
import { OKLCH_FALLBACK_GRAY } from '@/constants/colors';
import { RecurringDeleteDialog } from '../dialog/RecurringDeleteDialog';
import { RecurringUpdateDialog } from '../dialog/RecurringUpdateDialog';
import { StandardModal } from './StandardModal';

// Helper functions for monthly pattern calculations
const getDayName = (dayOfWeek: number): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
};

const getOrdinalNumber = (num: number): string => {
  const suffixes = ['st', 'nd', 'rd', 'th'];
  const mod10 = num % 10;
  const mod100 = num % 100;
  
  if (mod100 >= 11 && mod100 <= 13) {
    return num + 'th';
  }
  
  switch (mod10) {
    case 1: return num + 'st';
    case 2: return num + 'nd';
    case 3: return num + 'rd';
    default: return num + 'th';
  }
};

const getWeekOfMonthName = (week: number): string => {
  const weeks = ['', '1st', '2nd', '3rd', '4th', '2nd last', 'Last'];
  return weeks[week] || 'Last';
};

// Calculate which week of the month a date falls in
const getWeekOfMonth = (date: Date): number => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDayWeekday = firstDay.getDay();
  const dateNumber = date.getDate();
  
  // Calculate which week this date falls in
  const weekNumber = Math.ceil((dateNumber + firstDayWeekday) / 7);
  
  // Check if this is the last occurrence of this weekday in the month
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const remainingDays = lastDayOfMonth - dateNumber;
  const isLastOccurrence = remainingDays < 7;
  
  // Check if this is the second last occurrence
  const isSecondLastOccurrence = remainingDays >= 7 && remainingDays < 14 && weekNumber >= 3;
  
  if (isLastOccurrence && weekNumber >= 4) {
    return 6; // "Last"
  } else if (isSecondLastOccurrence) {
    return 5; // "2nd last"
  }
  
  return weekNumber;
};

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId?: string;
  defaultStartTime?: Date;
  defaultEndTime?: Date;
}

export function EventModal({ 
  isOpen, 
  onClose, 
  eventId,
  defaultStartTime,
  defaultEndTime
}: EventModalProps) {
  const { projects, groups } = useProjectContext();
  
  // Use PlannerContext as the primary context since PlannerV2 will replace Planner
  const { 
    events, 
    addEvent, 
    updateEvent,
    deleteEvent,
    getRecurringGroupEvents,
    deleteRecurringSeriesFuture,
    deleteRecurringSeriesAll,
    updateRecurringSeriesFuture,
    updateRecurringSeriesAll
  } = usePlannerContext();

  const [formData, setFormData] = useState<EventFormData>({
    description: '',
    notes: '',
    groupId: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    projectId: '',
    color: OKLCH_FALLBACK_GRAY,
    completed: false,
    isRecurring: false,
    recurringType: 'weekly',
    recurringInterval: 1,
    recurringEndType: 'never',
    recurringEndDate: '',
    recurringCount: 10,
    // New monthly pattern fields
    monthlyPattern: 'date',
    monthlyDate: 1,
    monthlyWeekOfMonth: 1,
    monthlyDayOfWeek: 1
  });

  const [errors, setErrors] = useState<EventFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [pendingUpdateData, setPendingUpdateData] = useState<Omit<CalendarEvent, 'id'> | null>(null);
  const [isRecurringEvent, setIsRecurringEvent] = useState(false);
  const [isCreatingRecurring, setIsCreatingRecurring] = useState(false);

  const isEditing = !!eventId;
  let existingEvent = isEditing ? events.find(e => e.id === eventId) : null;
  
  // Handle split events - if we can't find the event by ID, check if it's a split event
  if (!existingEvent && eventId?.includes('-split-')) {
    const originalEventId = eventId.split('-split-')[0];
    existingEvent = events.find(e => e.id === originalEventId);
    // If found, we'll track that this is a split event for special handling
  }

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
        const existingProject = projects.find(p => p.id === existingEvent.projectId);
        const groupId = existingProject ? existingProject.groupId : '';
        
        const eventDate = new Date(existingEvent.startTime);
        
        setFormData({
          description: existingEvent.title,
          notes: existingEvent.description || '',
          groupId,
          startDate: formatDate(new Date(existingEvent.startTime)),
          startTime: formatTime(new Date(existingEvent.startTime)),
          endDate: formatDate(new Date(existingEvent.endTime)),
          endTime: formatTime(new Date(existingEvent.endTime)),
          projectId: existingEvent.projectId || '',
          color: existingEvent.color || OKLCH_FALLBACK_GRAY,
          completed: existingEvent.completed || false,
          isRecurring: !!existingEvent.recurring,
          recurringType: existingEvent.recurring?.type || 'weekly',
          recurringInterval: existingEvent.recurring?.interval || 1,
          recurringEndType: existingEvent.recurring?.endDate ? 'date' : existingEvent.recurring?.count ? 'count' : 'never',
          recurringEndDate: existingEvent.recurring?.endDate ? formatDate(existingEvent.recurring.endDate) : '',
          recurringCount: existingEvent.recurring?.count || 10,
          // Monthly pattern fields - preload with current event's pattern or smart defaults
          monthlyPattern: existingEvent.recurring?.monthlyPattern || 'dayOfWeek',
          monthlyDate: existingEvent.recurring?.monthlyDate || eventDate.getDate(),
          monthlyWeekOfMonth: existingEvent.recurring?.monthlyWeekOfMonth || getWeekOfMonth(eventDate),
          monthlyDayOfWeek: existingEvent.recurring?.monthlyDayOfWeek || eventDate.getDay()
        });
      } else {
        // Reset for new event
        const startDate = defaultStartTime || new Date();
        const endDate = defaultEndTime || new Date(startDate.getTime() + 60 * 60 * 1000);
        setFormData({
          description: '',
          notes: '',
          groupId: '',
          startDate: formatDate(startDate),
          startTime: formatTime(startDate),
          endDate: formatDate(endDate),
          endTime: formatTime(endDate),
          projectId: '',
          color: OKLCH_FALLBACK_GRAY,
          completed: false,
          isRecurring: false,
          recurringType: 'weekly',
          recurringInterval: 1,
          recurringEndType: 'never',
          recurringEndDate: '',
          recurringCount: 10,
          // Smart defaults for monthly patterns based on the start date
          monthlyPattern: 'dayOfWeek',
          monthlyDate: startDate.getDate(),
          monthlyWeekOfMonth: getWeekOfMonth(startDate),
          monthlyDayOfWeek: startDate.getDay()
        });
      }
      setErrors({});
    }
  }, [isOpen, existingEvent, defaultStartTime, defaultEndTime, projects]);

  // Check if event is part of a recurring series
  useEffect(() => {
    const checkRecurringStatus = async () => {
      if (existingEvent) {
        try {
          // Get the original event ID in case this is a split event
          const originalEventId = eventId?.includes('-split-') 
            ? eventId.split('-split-')[0] 
            : existingEvent.id;
            
          const groupEvents = await getRecurringGroupEvents(originalEventId);
          setIsRecurringEvent(groupEvents.length > 1);
        } catch (error) {
          console.error('Failed to check recurring status:', error);
          setIsRecurringEvent(false);
        }
      } else {
        setIsRecurringEvent(false);
      }
    };

    if (isOpen && isEditing) {
      checkRecurringStatus();
    }
  }, [isOpen, isEditing, existingEvent, getRecurringGroupEvents, eventId]);

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
    const validationErrors = eventModalOrchestrator.validateEventForm(formData);
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);

    try {
      if (isEditing && existingEvent) {
        // Update existing event using orchestrator
        const result = await eventModalOrchestrator.updateEventWorkflow(
          formData,
          existingEvent,
          eventId || existingEvent.id,
          isRecurringEvent,
          updateEvent
        );

        if (result.success) {
          handleClose();
        } else if (result.needsRecurringDialog) {
          // Store the update data and show the recurring update dialog
          const eventData = eventModalOrchestrator.transformFormToEventData(formData, existingEvent);
          setPendingUpdateData(eventData);
          setShowUpdateDialog(true);
          setIsSubmitting(false);
          return;
        } else if (result.errors) {
          setErrors(result.errors);
        }
      } else {
        // Create new event using orchestrator
        const result = await eventModalOrchestrator.createEventWorkflow(
          formData, 
          async (eventData) => {
            await addEvent(eventData);
          }
        );

        if (result.success) {
          if (formData.isRecurring) {
            setIsCreatingRecurring(true);
          }
          handleClose();
        } else if (result.errors) {
          setErrors(result.errors);
        }
      }
    } catch (error) {
      console.error('Failed to save event:', error);
      setErrors({ submit: 'Failed to save event. Please try again.' });
    } finally {
      setIsSubmitting(false);
      setIsCreatingRecurring(false);
    }
  };

  const handleDelete = () => {
    if (!existingEvent) return;
    setShowDeleteDialog(true);
  };

  const handleDeleteThis = async () => {
    if (!existingEvent) return;
    
    const result = await eventModalOrchestrator.deleteEventWorkflow(
      existingEvent,
      eventId || existingEvent.id,
      deleteEvent
    );

    if (result.success) {
      setShowDeleteDialog(false);
      onClose();
    } else if (result.errors) {
      setErrors(result.errors);
      setShowDeleteDialog(false);
    }
  };

  const handleDeleteFuture = async () => {
    if (!existingEvent) return;
    
    const result = await eventModalOrchestrator.deleteRecurringEventWorkflow(
      'future',
      existingEvent,
      eventId || existingEvent.id,
      deleteEvent,
      deleteRecurringSeriesFuture,
      deleteRecurringSeriesAll
    );

    if (result.success) {
      setShowDeleteDialog(false);
      onClose();
    } else if (result.errors) {
      setErrors(result.errors);
      setShowDeleteDialog(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!existingEvent) return;
    
    const result = await eventModalOrchestrator.deleteRecurringEventWorkflow(
      'all',
      existingEvent,
      eventId || existingEvent.id,
      deleteEvent,
      deleteRecurringSeriesFuture,
      deleteRecurringSeriesAll
    );

    if (result.success) {
      setShowDeleteDialog(false);
      onClose();
    } else if (result.errors) {
      setErrors(result.errors);
      setShowDeleteDialog(false);
    }
  };

  const handleUpdateThis = async () => {
    if (!existingEvent || !pendingUpdateData) return;
    
    const result = await eventModalOrchestrator.updateRecurringEventWorkflow(
      'this',
      existingEvent,
      eventId || existingEvent.id,
      pendingUpdateData,
      updateEvent,
      updateRecurringSeriesFuture,
      updateRecurringSeriesAll
    );

    if (result.success) {
      setShowUpdateDialog(false);
      setPendingUpdateData(null);
      onClose();
    } else if (result.errors) {
      setErrors(result.errors);
      setShowUpdateDialog(false);
    }
  };

  const handleUpdateFuture = async () => {
    if (!existingEvent || !pendingUpdateData) return;
    
    const result = await eventModalOrchestrator.updateRecurringEventWorkflow(
      'future',
      existingEvent,
      eventId || existingEvent.id,
      pendingUpdateData,
      updateEvent,
      updateRecurringSeriesFuture,
      updateRecurringSeriesAll
    );

    if (result.success) {
      setShowUpdateDialog(false);
      setPendingUpdateData(null);
      onClose();
    } else if (result.errors) {
      setErrors(result.errors);
      setShowUpdateDialog(false);
    }
  };

  const handleUpdateAll = async () => {
    if (!existingEvent || !pendingUpdateData) return;
    
    const result = await eventModalOrchestrator.updateRecurringEventWorkflow(
      'all',
      existingEvent,
      eventId || existingEvent.id,
      pendingUpdateData,
      updateEvent,
      updateRecurringSeriesFuture,
      updateRecurringSeriesAll
    );

    if (result.success) {
      setShowUpdateDialog(false);
      setPendingUpdateData(null);
      onClose();
    } else if (result.errors) {
      setErrors(result.errors);
      setShowUpdateDialog(false);
    }
  };

  const selectedProject = formData.projectId ? projects.find(p => p.id === formData.projectId) : null;

  // Custom close handler to reset any ongoing operations
  const handleClose = () => {
    setIsSubmitting(false);
    setIsCreatingRecurring(false);
    setErrors({});
    onClose();
  };

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
    <>
      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title={isEditing ? 'Edit Event' : 'Create Event'}
        size="md"
        primaryAction={{
          label: isSubmitting || isCreatingRecurring ? 'Saving...' : (isEditing ? 'Update Event' : 'Create Event'),
          onClick: () => {
            const form = document.querySelector('form');
            if (form) {
              const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
              form.dispatchEvent(submitEvent);
            }
          },
          loading: isSubmitting || isCreatingRecurring,
          disabled: isSubmitting || isCreatingRecurring
        }}
        secondaryAction={{
          label: "Cancel",
          onClick: handleClose
        }}
        destructiveAction={isEditing ? {
          label: "Delete Event",
          onClick: handleDelete,
          icon: <Trash2 className="w-4 h-4" />
        } : undefined}
      >

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div className="space-y-1.5 relative">
            {/* Completion toggle positioned in top right, moved up into header gap */}
            <div className="absolute -top-3 right-0 z-10">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="completed"
                  checked={formData.completed}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, completed: !!checked }))}
                />
                <Label htmlFor="completed" className="flex items-center gap-2 cursor-pointer text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as completed
                </Label>
              </div>
            </div>
            
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter event description"
              className={errors.description ? 'border-destructive' : ''}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Allocate to Project */}
          <div className="space-y-2">
            <Label>Allocate to Project</Label>
            
            {/* Group Selection */}
            <div className="space-y-1.5">
              <Select value={formData.groupId || "none"} onValueChange={(value) => {
                const newGroupId = value === "none" ? "" : value;
                
                // When group changes, reset project and set to first project if group is selected
                let newProjectId = "";
                if (newGroupId) {
                  const groupProjects = projects.filter(project => project.groupId === newGroupId);
                  if (groupProjects.length > 0) {
                    newProjectId = groupProjects[0].id;
                  }
                }
                
                setFormData(prev => ({ 
                  ...prev, 
                  groupId: newGroupId,
                  projectId: newProjectId
                }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Selection - Only show when group is selected */}
            {formData.groupId && (
              <div className="space-y-1.5">
                <Select 
                  value={formData.projectId || ""} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects
                      .filter(project => project.groupId === formData.groupId)
                      .map((project) => (
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
            )}
          </div>

          {/* Date and Time Range */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className={errors.startDateTime ? 'border-destructive' : ''}
                />
              </div>
              
              <div className="space-y-1.5">
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
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  className={errors.endDateTime ? 'border-destructive' : ''}
                />
              </div>
              
              <div className="space-y-1.5">
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
                Duration: {formatDuration(calculateDurationHours(getStartDateTime(), getEndDateTime()))}
              </span>
            </div>
          )}

          {/* Recurring Options */}
          <div className="space-y-3">
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
              <div className="pl-6 space-y-3 border-l-2 border-muted">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
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
                  
                  <div className="space-y-1.5">
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

                {/* Monthly pattern selection */}
                {formData.recurringType === 'monthly' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Monthly pattern</Label>
                      <Select 
                        value={formData.monthlyPattern} 
                        onValueChange={(value: 'date' | 'dayOfWeek') => setFormData(prev => ({ ...prev, monthlyPattern: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">Specific date of month</SelectItem>
                          <SelectItem value="dayOfWeek">Day of week pattern</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date-based monthly pattern */}
                    {formData.monthlyPattern === 'date' && (
                      <div className="space-y-1.5">
                        <Label htmlFor="monthlyDate">On the</Label>
                        <Select 
                          value={formData.monthlyDate.toString()} 
                          onValueChange={(value) => setFormData(prev => ({ ...prev, monthlyDate: parseInt(value) }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(date => (
                              <SelectItem key={date} value={date.toString()}>
                                {getOrdinalNumber(date)} of the month
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Day-of-week based monthly pattern */}
                    {formData.monthlyPattern === 'dayOfWeek' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Week of month</Label>
                          <Select 
                            value={formData.monthlyWeekOfMonth.toString()} 
                            onValueChange={(value) => setFormData(prev => ({ ...prev, monthlyWeekOfMonth: parseInt(value) }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1st week</SelectItem>
                              <SelectItem value="2">2nd week</SelectItem>
                              <SelectItem value="3">3rd week</SelectItem>
                              <SelectItem value="4">4th week</SelectItem>
                              <SelectItem value="5">2nd last week</SelectItem>
                              <SelectItem value="6">Last week</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Day of week</Label>
                          <Select 
                            value={formData.monthlyDayOfWeek.toString()} 
                            onValueChange={(value) => setFormData(prev => ({ ...prev, monthlyDayOfWeek: parseInt(value) }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Sunday</SelectItem>
                              <SelectItem value="1">Monday</SelectItem>
                              <SelectItem value="2">Tuesday</SelectItem>
                              <SelectItem value="3">Wednesday</SelectItem>
                              <SelectItem value="4">Thursday</SelectItem>
                              <SelectItem value="5">Friday</SelectItem>
                              <SelectItem value="6">Saturday</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Preview text for monthly patterns */}
                    <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                      <strong>Preview:</strong> Events will recur{' '}
                      {formData.monthlyPattern === 'date' 
                        ? `on the ${getOrdinalNumber(formData.monthlyDate)} of each month`
                        : `on the ${getWeekOfMonthName(formData.monthlyWeekOfMonth)} ${getDayName(formData.monthlyDayOfWeek)} of each month`
                      }
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
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
                  <div className="space-y-1.5">
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
                  <div className="space-y-1.5">
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

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add additional notes (optional)"
              rows={3}
            />
          </div>

          {/* Error Messages */}
          {errors.submit && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {errors.submit}
            </div>
          )}
        </form>
      </StandardModal>

      {/* Recurring Delete Dialog */}
      <RecurringDeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onDeleteThis={handleDeleteThis}
        onDeleteFuture={handleDeleteFuture}
        onDeleteAll={handleDeleteAll}
        eventTitle={existingEvent?.title || ''}
        isRecurring={isRecurringEvent}
      />

      {/* Recurring Update Dialog */}
      <RecurringUpdateDialog
        isOpen={showUpdateDialog}
        onClose={() => setShowUpdateDialog(false)}
        onUpdateThis={handleUpdateThis}
        onUpdateFuture={handleUpdateFuture}
        onUpdateAll={handleUpdateAll}
        eventTitle={existingEvent?.title || ''}
        isRecurring={isRecurringEvent}
      />
    </>
  );
}