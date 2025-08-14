import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { ChevronLeft, ChevronRight, Clock, Calendar, MapPin } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

import { DragDropCalendar } from './DragDropCalendar';
import { WorkHourChangeModal } from './WorkHourChangeModal';
import { CalendarEvent, WorkHour } from '../types';
import { WorkSlot, WorkHourOverride } from '../contexts/AppContext';
import { validateWorkSlotTimes, suggestNonOverlappingTime } from '@/lib/workSlotOverlapUtils';

type CalendarMode = 'events' | 'work-hours';

export function CalendarView() {
  const { 
    currentDate, 
    setCurrentDate, 
    events, 
    addEvent, 
    updateEvent, 
    settings,
    workHourOverrides,
    updateSettings,
    addWorkHourOverride,
    setSelectedEventId,
    setCreatingNewEvent
  } = useApp();
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('events');
  
  // Work hour change modal state
  const [workHourChangeModal, setWorkHourChangeModal] = useState<{
    isOpen: boolean;
    changeType: 'modify' | 'new' | null;
    workHour: WorkHour | null;
    changes: {
      startTime: Date;
      endTime: Date;
      duration: number;
    } | null;
    workHourInfo: {
      day: string;
      startTime: string;
      endTime: string;
      duration: number;
    } | null;
    hasOverlaps: boolean;
    overlapWarning: string | null;
  }>({
    isOpen: false,
    changeType: null,
    workHour: null,
    changes: null,
    workHourInfo: null,
    hasOverlaps: false,
    overlapWarning: null
  });
  
  // Track when to reset drag states
  const [resetWorkHourDragState, setResetWorkHourDragState] = useState(false);
  
  // Generate work hours from settings work slots
  const workHours = useMemo(() => {
    const generatedWorkHours: WorkHour[] = [];
    const dayNames: (keyof typeof settings.weeklyWorkHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    // Get the start of the current week (Monday)
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    // Adjust for Monday start: if day is 0 (Sunday), go back 6 days; otherwise go back (day - 1) days
    const daysToSubtract = day === 0 ? 6 : day - 1;
    startOfWeek.setDate(currentDate.getDate() - daysToSubtract);
    
    // Generate work hours for multiple weeks (previous 2 weeks + current week + next 5 weeks for full visibility)
    for (let weekOffset = -2; weekOffset < 6; weekOffset++) {
      dayNames.forEach((dayName, dayIndex) => {
        const daySlots = settings.weeklyWorkHours[dayName] || [];
        
        // Handle both old format (number) and new format (WorkSlot[])
        const slots: WorkSlot[] = Array.isArray(daySlots) ? daySlots : [];
        
        slots.forEach((slot, slotIndex) => {
          // Calculate the date for this day
          const slotDate = new Date(startOfWeek);
          slotDate.setDate(startOfWeek.getDate() + dayIndex + (weekOffset * 7));
          const dateString = slotDate.toISOString().split('T')[0]; // YYYY-MM-DD format
          
          // Check if there's an override for this specific date and slot
          const override = workHourOverrides.find(o => 
            o.date === dateString && 
            o.dayName === dayName && 
            o.slotIndex === slotIndex
          );
          
          // Use override values if available, otherwise use settings
          const effectiveSlot = override ? {
            id: slot.id,
            startTime: override.startTime,
            endTime: override.endTime,
            duration: override.duration
          } : slot;
          
          // Parse start time
          const [startHour, startMin] = effectiveSlot.startTime.split(':').map(Number);
          const startTime = new Date(slotDate);
          startTime.setHours(startHour, startMin, 0, 0);
          
          // Parse end time
          const [endHour, endMin] = effectiveSlot.endTime.split(':').map(Number);
          const endTime = new Date(slotDate);
          endTime.setHours(endHour, endMin, 0, 0);
          
          // Create work hour entry
          generatedWorkHours.push({
            id: `work-${dayName}-${slotIndex}-week${weekOffset}`,
            title: slots.length > 1 ? `Work Slot ${slotIndex + 1}` : 'Work Hours',
            startTime,
            endTime,
            duration: effectiveSlot.duration,
            type: 'work'
          });
        });
      });
    }
    
    return generatedWorkHours;
  }, [settings.weeklyWorkHours, workHourOverrides, currentDate]);

  // Dummy events data (only add if no events exist)
  useEffect(() => {
    if (events.length === 0) {
      const getEventDate = (daysFromToday: number, hour: number, duration: number = 1) => {
        const date = new Date();
        date.setDate(date.getDate() + daysFromToday);
        const startTime = new Date(date);
        startTime.setHours(hour, 0, 0, 0);
        const endTime = new Date(startTime);
        endTime.setHours(hour + duration, 0, 0, 0);
        return { startTime, endTime, duration };
      };

      // Add dummy events - some connected to projects, some standalone
      addEvent({
        title: 'Client Presentation',
        description: 'Present initial wireframes and design concepts to the client',
        projectId: '1', // Connected to "Website Redesign" project - will inherit blue color
        ...getEventDate(2, 14, 1.5), // Day after tomorrow 2pm-3:30pm
      });

      addEvent({
        title: 'Team Standup',
        description: 'Daily standup meeting with the development team',
        projectId: '2', // Connected to "Mobile App Development" project - will inherit red color
        ...getEventDate(4, 9, 0.5), // 4 days from now 9am-9:30am
      });

      addEvent({
        title: 'Personal Appointment',
        description: 'Doctor appointment - not work related',
        // No projectId - standalone event with custom color
        ...getEventDate(1, 16, 1), // Tomorrow 4pm-5pm
        color: '#10b981' // Green color
      });

      addEvent({
        title: 'Brand Strategy Meeting',
        description: 'Initial brand strategy discussion with the creative team',
        projectId: '3', // Connected to "Brand Identity" project - will inherit purple color
        ...getEventDate(5, 10, 2), // 5 days from now 10am-12pm
      });
    }
  }, [events.length, addEvent]);

  const navigateDate = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  // Handle drag-created events (immediately create)
  const handleDragCreateEvent = (startDateTime: Date, endDateTime: Date) => {
    const duration = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60); // hours
    
    // Create event immediately with default title and color
    addEvent({
      title: 'New Event',
      startTime: startDateTime,
      endTime: endDateTime,
      duration,
      color: '#3b82f6' // Default blue color
    });
  };

  // Handle click-created events (open event creation modal)
  const handleClickCreateEvent = (startDateTime: Date) => {
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(startDateTime.getHours() + 1); // Default 1 hour duration
    
    setCreatingNewEvent({
      startTime: startDateTime,
      endTime: endDateTime
    });
  };

  // Handle editing an existing event (open event editing modal)
  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEventId(event.id);
  };

  const handleEventDrop = (eventId: string, newStartTime: Date) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const duration = event.duration;
    const newEndTime = new Date(newStartTime);
    newEndTime.setHours(newStartTime.getHours() + Math.floor(duration));
    newEndTime.setMinutes(newStartTime.getMinutes() + ((duration % 1) * 60));

    updateEvent(eventId, {
      startTime: newStartTime,
      endTime: newEndTime
    });
  };

  const handleEventUpdate = (eventId: string, updates: Partial<CalendarEvent>) => {
    updateEvent(eventId, updates);
  };

  const getCurrentPeriod = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    // Adjust for Monday start: if day is 0 (Sunday), go back 6 days; otherwise go back (day - 1) days
    const daysToSubtract = day === 0 ? 6 : day - 1;
    startOfWeek.setDate(currentDate.getDate() - daysToSubtract);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const sameMonth = startOfWeek.getMonth() === endOfWeek.getMonth();
    
    if (sameMonth) {
      return `${startOfWeek.toLocaleDateString('en-US', { 
        month: 'long',
        day: 'numeric'
      })} - ${endOfWeek.toLocaleDateString('en-US', { 
        day: 'numeric',
        year: 'numeric'
      })}`;
    } else {
      return `${startOfWeek.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric'
      })} - ${endOfWeek.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })}`;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Work hour handlers
  const handleCreateWorkHour = (workHour: {
    startTime: Date;
    endTime: Date;
    duration: number;
    day: string;
  }) => {
    const startTime = workHour.startTime.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const endTime = workHour.endTime.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Check for overlaps with existing slots
    const dayName = workHour.day as keyof typeof settings.weeklyWorkHours;
    const existingSlots = settings.weeklyWorkHours[dayName] || [];
    const validation = validateWorkSlotTimes(startTime, endTime, existingSlots);

    let overlapWarning = null;
    if (!validation.isValid && validation.overlaps.length > 0) {
      const formatTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      };
      
      const overlappingTimes = validation.overlaps.map(slot => 
        `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`
      ).join(', ');
      
      overlapWarning = `This work hour conflicts with existing slots: ${overlappingTimes}. You may want to adjust the timing.`;
    }

    setWorkHourChangeModal({
      isOpen: true,
      changeType: 'new',
      workHour: null,
      changes: workHour,
      workHourInfo: {
        day: workHour.day,
        startTime,
        endTime,
        duration: workHour.duration
      },
      hasOverlaps: !validation.isValid,
      overlapWarning
    });
  };

  const handleShowWorkHourChangeModal = (workHour: WorkHour, changeType: 'modify', changes: {
    startTime: Date;
    endTime: Date;
    duration: number;
  }) => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[changes.startTime.getDay()];

    const startTime = changes.startTime.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const endTime = changes.endTime.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Check for overlaps with existing slots
    const daySlotName = dayName as keyof typeof settings.weeklyWorkHours;
    const existingSlots = settings.weeklyWorkHours[daySlotName] || [];
    
    // Extract the original slot ID for exclusion from overlap check
    // Work hour ID format: "work-dayname-slotindex-weekoffset"
    const workHourIdParts = workHour.id.split('-');
    const originalSlotId = workHourIdParts.length >= 3 ? workHourIdParts[2] : undefined;
    
    const validation = validateWorkSlotTimes(startTime, endTime, existingSlots, originalSlotId);

    let overlapWarning = null;
    if (!validation.isValid && validation.overlaps.length > 0) {
      const formatTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      };
      
      const overlappingTimes = validation.overlaps.map(slot => 
        `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`
      ).join(', ');
      
      overlapWarning = `This change conflicts with existing slots: ${overlappingTimes}. You may want to adjust the timing.`;
    }

    setWorkHourChangeModal({
      isOpen: true,
      changeType,
      workHour,
      changes,
      workHourInfo: {
        day: dayName,
        startTime,
        endTime,
        duration: changes.duration
      },
      hasOverlaps: !validation.isValid,
      overlapWarning
    });
  };

  const handleWorkHourModalConfirm = (scope: 'just-this' | 'all-future' | 'permanent') => {
    if (!workHourChangeModal.changes || !workHourChangeModal.workHourInfo) return;

    const { changes, workHourInfo, changeType, workHour } = workHourChangeModal;
    const dayName = workHourInfo.day as keyof typeof settings.weeklyWorkHours;

    if (changeType === 'new') {
      if (scope === 'permanent') {
        // Add new permanent slot to settings
        const currentSlots = settings.weeklyWorkHours[dayName] || [];
        const newSlot: WorkSlot = {
          id: Date.now().toString(),
          startTime: workHourInfo.startTime,
          endTime: workHourInfo.endTime,
          duration: workHourInfo.duration
        };

        updateSettings({
          weeklyWorkHours: {
            ...settings.weeklyWorkHours,
            [dayName]: [...currentSlots, newSlot]
          }
        });
      }
      // For 'just-this' scope, we would need to implement day-specific overrides
      // This is more complex and would require extending the data model
    } else if (changeType === 'modify' && workHour) {
      if (scope === 'just-this') {
        // Create an override for this specific date only
        const dateString = changes.startTime.toISOString().split('T')[0]; // YYYY-MM-DD format
        const workHourIdParts = workHour.id.split('-');
        const slotIndex = workHourIdParts.length >= 3 ? parseInt(workHourIdParts[2]) : 0;

        const override: WorkHourOverride = {
          date: dateString,
          dayName: dayName as WorkHourOverride['dayName'],
          slotIndex,
          startTime: workHourInfo.startTime,
          endTime: workHourInfo.endTime,
          duration: workHourInfo.duration
        };

        addWorkHourOverride(override);
      } else if (scope === 'all-future') {
        // Update settings for all future occurrences
        const currentSlots = settings.weeklyWorkHours[dayName] || [];
        
        // Extract the original slot index from the work hour ID
        const workHourIdParts = workHour.id.split('-');
        const slotIndex = workHourIdParts.length >= 3 ? parseInt(workHourIdParts[2]) : 0;
        
        if (slotIndex >= 0 && slotIndex < currentSlots.length) {
          const updatedSlots = [...currentSlots];
          updatedSlots[slotIndex] = {
            ...updatedSlots[slotIndex],
            startTime: workHourInfo.startTime,
            endTime: workHourInfo.endTime,
            duration: workHourInfo.duration
          };

          updateSettings({
            weeklyWorkHours: {
              ...settings.weeklyWorkHours,
              [dayName]: updatedSlots
            }
          });
        }
      }
    }

    setWorkHourChangeModal({
      isOpen: false,
      changeType: null,
      workHour: null,
      changes: null,
      workHourInfo: null,
      hasOverlaps: false,
      overlapWarning: null
    });
    
    // Reset drag states
    setResetWorkHourDragState(true);
    setTimeout(() => setResetWorkHourDragState(false), 10);
  };

  const handleWorkHourModalClose = () => {
    setWorkHourChangeModal({
      isOpen: false,
      changeType: null,
      workHour: null,
      changes: null,
      workHourInfo: null,
      hasOverlaps: false,
      overlapWarning: null
    });
    
    // Reset drag states when canceled
    setResetWorkHourDragState(true);
    setTimeout(() => setResetWorkHourDragState(false), 10);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Calendar Header */}
      <div className="h-20 border-b border-[#e2e2e2] flex items-center px-8">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold text-[#595956]">Calendar</h1>
        </div>
      </div>

      {/* Calendar Mode Toggle and Navigation */}
      <div className="px-6 p-[21px]">
        <div className="flex items-center justify-between">
          {/* Calendar Mode Toggle and Today Button */}
          <div className="flex items-center" style={{ gap: '21px' }}>
            <ToggleGroup
              type="single"
              value={calendarMode}
              onValueChange={(value) => value && setCalendarMode(value as CalendarMode)}
              variant="outline"
              className="bg-white border border-border h-9"
            >
              <ToggleGroupItem value="events" aria-label="Events mode" className="px-3 py-2 gap-2 flex-none hover:bg-gray-100 data-[state=on]:bg-accent h-9">
                <Calendar className="w-4 h-4" />
                Events
              </ToggleGroupItem>
              <ToggleGroupItem value="work-hours" aria-label="Work hours mode" className="px-3 py-2 gap-2 flex-none hover:bg-gray-100 data-[state=on]:bg-accent h-9">
                <Clock className="w-4 h-4" />
                Work Hours
              </ToggleGroupItem>
            </ToggleGroup>
            
            <Button variant="outline" onClick={goToToday} className="h-9 gap-2">
              <MapPin className="w-4 h-4" />
              Today
            </Button>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <h2 className="text-xl font-semibold text-gray-900 min-w-[280px] text-center">
              {getCurrentPeriod()}
            </h2>
            
            <Button variant="ghost" size="icon" onClick={() => navigateDate(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area with Card */}
      <div className="flex-1 flex flex-col px-6 pb-6 min-h-0">
        <div className="flex-1 flex flex-col min-h-0 pt-[0px] pr-[0px] pb-[21px] pl-[0px]">
          <Card className="flex-1 flex flex-col overflow-hidden">
            {/* Calendar Content */}
            <div className="flex-1 min-h-0 bg-white">
              <DragDropCalendar
                viewType="week"
                currentDate={currentDate}
                events={events}
                workHours={workHours}
                viewMode="overlay"
                calendarMode={calendarMode}
                onEventDrop={handleEventDrop}
                onDragCreateEvent={calendarMode === 'events' ? handleDragCreateEvent : undefined}
                onClickCreateEvent={calendarMode === 'events' ? handleClickCreateEvent : undefined}
                onEventEdit={handleEditEvent}
                onEventUpdate={handleEventUpdate}
                onShowWorkHourChangeModal={handleShowWorkHourChangeModal}
                onCreateWorkHour={handleCreateWorkHour}
                resetWorkHourDragState={resetWorkHourDragState}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Work Hour Change Modal */}
      <WorkHourChangeModal
        isOpen={workHourChangeModal.isOpen}
        onClose={handleWorkHourModalClose}
        changeType={workHourChangeModal.changeType}
        workHourInfo={workHourChangeModal.workHourInfo}
        onConfirm={handleWorkHourModalConfirm}
        hasOverlaps={workHourChangeModal.hasOverlaps}
        overlapWarning={workHourChangeModal.overlapWarning}
      />
    </div>
  );
}