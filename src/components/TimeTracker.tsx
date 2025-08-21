import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useAppDataOnly, useAppActionsOnly } from '../contexts/AppContext';
import { CalendarEvent } from '../types';

interface TimeTrackerProps {
  className?: string;
}

export function TimeTracker({ className }: TimeTrackerProps) {
  const { projects, events } = useAppDataOnly();
  const { addEvent, updateEvent, deleteEvent } = useAppActionsOnly();
  
  const [isTracking, setIsTracking] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [seconds, setSeconds] = useState(0);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [affectedPlannedEvents, setAffectedPlannedEvents] = useState<string[]>([]);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const liveUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Storage keys for persistence
  const STORAGE_KEYS = {
    isTracking: 'timeTracker_isTracking',
    startTime: 'timeTracker_startTime',
    eventId: 'timeTracker_eventId',
    selectedProject: 'timeTracker_selectedProject',
    searchQuery: 'timeTracker_searchQuery',
    affectedEvents: 'timeTracker_affectedEvents'
  };

  // Load tracking state from localStorage on mount
  useEffect(() => {
    const loadTrackingState = () => {
      const savedIsTracking = localStorage.getItem(STORAGE_KEYS.isTracking) === 'true';
      const savedStartTime = localStorage.getItem(STORAGE_KEYS.startTime);
      const savedEventId = localStorage.getItem(STORAGE_KEYS.eventId);
      const savedProject = localStorage.getItem(STORAGE_KEYS.selectedProject);
      const savedQuery = localStorage.getItem(STORAGE_KEYS.searchQuery);
      const savedAffectedEvents = localStorage.getItem(STORAGE_KEYS.affectedEvents);

      if (savedIsTracking && savedStartTime && savedEventId) {
        const startTime = new Date(savedStartTime);
        const now = new Date();
        const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        
        setIsTracking(true);
        setSeconds(elapsedSeconds);
        setCurrentEventId(savedEventId);
        startTimeRef.current = startTime;
        
        if (savedProject) {
          try {
            setSelectedProject(JSON.parse(savedProject));
          } catch (e) {
            console.error('Failed to parse saved project:', e);
          }
        }
        
        if (savedQuery) {
          setSearchQuery(savedQuery);
        }

        if (savedAffectedEvents) {
          try {
            setAffectedPlannedEvents(JSON.parse(savedAffectedEvents));
          } catch (e) {
            console.error('Failed to parse saved affected events:', e);
          }
        }
        
        // Start the timer interval
        intervalRef.current = setInterval(() => {
          setSeconds(prev => prev + 1);
        }, 1000);

        // Start live update interval
        startLiveUpdates(savedEventId, startTime);
      }
    };

    loadTrackingState();
  }, []);

  // Check for overlapping planned events and adjust them
  const handlePlannedEventOverlaps = (trackingStart: Date, trackingEnd: Date) => {
    const overlappingEvents = events.filter(event => 
      event.type === 'planned' && 
      event.id !== currentEventId &&
      (
        // Event starts during tracking period
        (event.startTime >= trackingStart && event.startTime < trackingEnd) ||
        // Event ends during tracking period  
        (event.endTime > trackingStart && event.endTime <= trackingEnd) ||
        // Event completely contains tracking period
        (event.startTime <= trackingStart && event.endTime >= trackingEnd) ||
        // Tracking period completely contains event
        (trackingStart <= event.startTime && trackingEnd >= event.endTime)
      )
    );

    const newAffectedEvents: string[] = [];
    
    overlappingEvents.forEach(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      
      if (trackingStart <= eventStart && trackingEnd >= eventEnd) {
        // Tracking completely overlaps the planned event - delete it
        deleteEvent(event.id);
      } else if (trackingStart > eventStart && trackingEnd < eventEnd) {
        // Tracking is in the middle of planned event - split it
        const originalDuration = event.duration || 
          (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
        
        // Create first part (before tracking)
        const firstPartEnd = new Date(trackingStart);
        const firstPartDuration = (firstPartEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
        
        updateEvent(event.id, {
          endTime: firstPartEnd,
          duration: firstPartDuration
        }, { silent: true });
        
        // Create second part (after tracking) if there's enough time
        const secondPartStart = new Date(trackingEnd);
        const secondPartDuration = (eventEnd.getTime() - secondPartStart.getTime()) / (1000 * 60 * 60);
        
        if (secondPartDuration > 0.1) { // Only create if > 6 minutes
          addEvent({
            title: event.title,
            startTime: secondPartStart,
            endTime: eventEnd,
            projectId: event.projectId,
            color: event.color,
            description: event.description,
            duration: secondPartDuration,
            type: 'planned'
          });
        }
      } else if (trackingStart <= eventStart && trackingEnd > eventStart) {
        // Tracking overlaps start of planned event - trim the start
        const newStart = new Date(trackingEnd);
        const newDuration = (eventEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60);
        
        if (newDuration > 0.1) { // Only keep if > 6 minutes
          updateEvent(event.id, {
            startTime: newStart,
            duration: newDuration
          }, { silent: true });
          newAffectedEvents.push(event.id);
        } else {
          deleteEvent(event.id);
        }
      } else if (trackingStart < eventEnd && trackingEnd >= eventEnd) {
        // Tracking overlaps end of planned event - trim the end
        const newEnd = new Date(trackingStart);
        const newDuration = (newEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
        
        if (newDuration > 0.1) { // Only keep if > 6 minutes
          updateEvent(event.id, {
            endTime: newEnd,
            duration: newDuration
          }, { silent: true });
          newAffectedEvents.push(event.id);
        } else {
          deleteEvent(event.id);
        }
      }
    });

    setAffectedPlannedEvents(newAffectedEvents);
    return newAffectedEvents;
  };

  // Start live updates for the tracking event
  const startLiveUpdates = (eventId: string, startTime: Date) => {
    if (liveUpdateIntervalRef.current) {
      clearInterval(liveUpdateIntervalRef.current);
    }

    liveUpdateIntervalRef.current = setInterval(() => {
      const now = new Date();
      const duration = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      
      // Update the tracking event silently (no toast notifications)
      updateEvent(eventId, {
        endTime: now,
        duration
      }, { silent: true });

      // Check for new overlaps as the event grows
      const affected = handlePlannedEventOverlaps(startTime, now);
      
      // Save affected events to localStorage
      localStorage.setItem(STORAGE_KEYS.affectedEvents, JSON.stringify(affected));
    }, 5000); // Update every 5 seconds
  };

  // Save tracking state to localStorage
  const saveTrackingState = (trackingData: {
    isTracking: boolean;
    startTime?: Date;
    eventId?: string | null;
    selectedProject?: any;
    searchQuery?: string;
    affectedEvents?: string[];
  }) => {
    if (trackingData.isTracking) {
      localStorage.setItem(STORAGE_KEYS.isTracking, 'true');
      if (trackingData.startTime) {
        localStorage.setItem(STORAGE_KEYS.startTime, trackingData.startTime.toISOString());
      }
      if (trackingData.eventId) {
        localStorage.setItem(STORAGE_KEYS.eventId, trackingData.eventId);
      }
      if (trackingData.selectedProject) {
        localStorage.setItem(STORAGE_KEYS.selectedProject, JSON.stringify(trackingData.selectedProject));
      }
      if (trackingData.searchQuery) {
        localStorage.setItem(STORAGE_KEYS.searchQuery, trackingData.searchQuery);
      }
      if (trackingData.affectedEvents) {
        localStorage.setItem(STORAGE_KEYS.affectedEvents, JSON.stringify(trackingData.affectedEvents));
      }
    } else {
      // Clear all tracking data
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    }
  };

  // Filter projects and clients based on search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const results: Array<{type: 'project' | 'client', id: string, name: string, client?: string}> = [];
    
    // Search projects
    projects.forEach(project => {
      if (project.name.toLowerCase().includes(query) || 
          project.client.toLowerCase().includes(query)) {
        results.push({
          type: 'project',
          id: project.id,
          name: project.name,
          client: project.client
        });
      }
    });
    
    // Search unique clients
    const uniqueClients = [...new Set(projects.map(p => p.client))];
    uniqueClients.forEach(client => {
      if (client.toLowerCase().includes(query) && 
          !results.some(r => r.type === 'client' && r.name === client)) {
        results.push({
          type: 'client',
          id: client,
          name: client
        });
      }
    });
    
    return results.slice(0, 8); // Limit to 8 results
  }, [searchQuery, projects]);

  // Format time display
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle search selection
  const handleSelectItem = (item: any) => {
    if (item.type === 'project') {
      const project = projects.find(p => p.id === item.id);
      setSelectedProject(project);
      setSearchQuery(project ? `${project.name} (${project.client})` : '');
    } else {
      // Client selected - use just client name
      setSelectedProject({ client: item.name, name: item.name });
      setSearchQuery(item.name);
    }
    setShowSearchDropdown(false);
  };

  // Start/stop tracking
  const handleToggleTracking = async () => {
    if (!isTracking) {
      // Start tracking
      if (!selectedProject && !searchQuery.trim()) {
        setShowSearchDropdown(true);
        return;
      }
      
      const now = new Date();
      startTimeRef.current = now;
      setSeconds(0);
      setIsTracking(true);
      
      // Create tracking event with distinctive styling
      const eventData: Omit<CalendarEvent, 'id'> = {
        title: `🔴 ${selectedProject?.name || searchQuery || 'Time Tracking'}`,
        startTime: now,
        endTime: new Date(now.getTime() + 60000), // Start with 1 minute
        projectId: selectedProject?.id,
        color: selectedProject?.color || '#DC2626', // Red color for tracking
        description: `Active time tracking${selectedProject ? ` for ${selectedProject.name}` : ''}`,
        duration: 0.0167, // 1 minute in hours
        type: 'tracked'
      };
      
      try {
        // Create the tracking event
        const createdEvent = await addEvent(eventData) as unknown as CalendarEvent;
        
        // Use the actual event ID from the database
        setCurrentEventId(createdEvent.id);
        
        // Start live updates immediately
        startLiveUpdates(createdEvent.id, now);
        
        // Save tracking state
        saveTrackingState({
          isTracking: true,
          startTime: now,
          eventId: createdEvent.id,
          selectedProject,
          searchQuery,
          affectedEvents: []
        });
        
      } catch (error) {
        console.error('Failed to create tracking event:', error);
        setIsTracking(false);
        startTimeRef.current = null;
        return;
      }
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
      
    } else {
      // Stop tracking
      setIsTracking(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (liveUpdateIntervalRef.current) {
        clearInterval(liveUpdateIntervalRef.current);
        liveUpdateIntervalRef.current = null;
      }
      
      if (currentEventId && startTimeRef.current) {
        const endTime = new Date();
        const duration = (endTime.getTime() - startTimeRef.current.getTime()) / (1000 * 60 * 60); // hours
        
        try {
          // Final update to the tracking event - mark as completed
          await updateEvent(currentEventId, {
            endTime,
            duration,
            title: (selectedProject?.name || searchQuery || 'Time Tracking'), // Clean title
            description: `Completed time tracking${selectedProject ? ` for ${selectedProject.name}` : ''} - ${formatTime(seconds)}`,
            completed: true, // Mark as completed
            type: 'completed' // Change type to completed
          });
          
          // Handle any final overlaps
          handlePlannedEventOverlaps(startTimeRef.current, endTime);
          
        } catch (error) {
          console.error('Failed to update tracking event:', error);
        }
      }
      
      // Reset everything and clear localStorage
      setCurrentEventId(null);
      startTimeRef.current = null;
      setSeconds(0);
      setSelectedProject(null);
      setSearchQuery('');
      setAffectedPlannedEvents([]);
      
      // Clear tracking state from localStorage
      saveTrackingState({ isTracking: false });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (liveUpdateIntervalRef.current) {
        clearInterval(liveUpdateIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Search Input with Dropdown */}
      <Popover open={showSearchDropdown} onOpenChange={setShowSearchDropdown}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              placeholder="What are you working on?"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              className="w-64 h-10 bg-background border-border focus:border-primary cursor-text"
              disabled={isTracking}
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="max-h-64 overflow-y-auto">
            {searchResults.length > 0 ? (
              searchResults.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  className="w-full px-3 py-2 text-left hover:bg-accent/50 border-b border-border/30 last:border-b-0"
                  onClick={() => handleSelectItem(item)}
                >
                  <div className="flex items-center gap-2">
                    {item.type === 'project' && (
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: projects.find(p => p.id === item.id)?.color || '#8B5CF6' }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {item.name}
                      </div>
                      {item.type === 'project' && item.client && (
                        <div className="text-xs text-muted-foreground truncate">
                          {item.client}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))
            ) : searchQuery.trim() ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No projects or clients found
              </div>
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                Start typing to search projects and clients
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Timer Display */}
      <div className="text-lg font-semibold tabular-nums text-foreground min-w-[5.5rem] text-center">
        {formatTime(seconds)}
      </div>

      {/* Play/Pause Button */}
      <Button
        onClick={handleToggleTracking}
        size="sm"
        className={`w-10 h-10 rounded-full p-0 transition-colors ${
          isTracking 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : 'bg-primary hover:bg-primary/90 text-primary-foreground'
        }`}
      >
        {isTracking ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </Button>
    </div>
  );
}