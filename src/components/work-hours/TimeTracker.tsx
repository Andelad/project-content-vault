import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Square, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { CalendarEvent } from '../../types';
import { calculateOverlapActions, findOverlappingEvents } from '@/services';
import { formatTimeSeconds } from '@/services';
import { 
  processEventOverlaps, 
  calculateElapsedTime, 
  createTimeRange,
  type EventSplitResult 
} from '@/services';
import { TimeTrackerCalculationService } from '@/services/tracker';

interface TimeTrackerProps {
  className?: string;
}

export function TimeTracker({ className }: TimeTrackerProps) {
  const { projects } = useProjectContext();
  const { events, addEvent, updateEvent, deleteEvent } = usePlannerContext();
  const { isTimeTracking, setIsTimeTracking } = useSettingsContext();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [seconds, setSeconds] = useState(0);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [affectedPlannedEvents, setAffectedPlannedEvents] = useState<string[]>([]);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const liveUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Storage keys from service
  const STORAGE_KEYS = TimeTrackerCalculationService.getStorageKeys();

  // Load tracking state from localStorage on mount
  useEffect(() => {
    const loadTrackingState = () => {
      const trackingState = TimeTrackerCalculationService.loadTrackingState();
      
      if (trackingState && trackingState.startTime && trackingState.eventId) {
        const { totalSeconds: elapsedSeconds } = TimeTrackerCalculationService.calculateElapsedTime(trackingState.startTime);
        
        setIsTimeTracking(true);
        setSeconds(elapsedSeconds);
        setCurrentEventId(trackingState.eventId);
        startTimeRef.current = trackingState.startTime;
        
        if (trackingState.selectedProject) {
          setSelectedProject(trackingState.selectedProject);
        }
        
        if (trackingState.searchQuery) {
          setSearchQuery(trackingState.searchQuery);
        }

        if (trackingState.affectedEvents) {
          setAffectedPlannedEvents(trackingState.affectedEvents);
        }
        
        // Start the timer interval
        intervalRef.current = setInterval(() => {
          setSeconds(prev => prev + 1);
        }, 1000);

        // Start live update interval
        startLiveUpdates(trackingState.eventId, trackingState.startTime);
      }
    };

    loadTrackingState();
  }, []);

  // Check for overlapping planned events and adjust them
  const handlePlannedEventOverlaps = (trackingStart: Date, trackingEnd: Date) => {
    const affectedEvents = TimeTrackerCalculationService.handlePlannedEventOverlaps(
      events,
      trackingStart,
      trackingEnd,
      currentEventId,
      deleteEvent,
      updateEvent,
      addEvent
    );
    
    setAffectedPlannedEvents(affectedEvents);
    return affectedEvents;
  };

  // Start live updates for the tracking event
  const startLiveUpdates = (eventId: string, startTime: Date) => {
    if (liveUpdateIntervalRef.current) {
      clearInterval(liveUpdateIntervalRef.current);
    }

    liveUpdateIntervalRef.current = setInterval(() => {
      const { duration } = TimeTrackerCalculationService.calculateElapsedTime(startTime);
      
      // Update the tracking event silently (no toast notifications)
      updateEvent(eventId, {
        endTime: new Date(),
        duration
      }, { silent: true });

      // Check for new overlaps as the event grows
      const affected = handlePlannedEventOverlaps(startTime, new Date());
      
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
    TimeTrackerCalculationService.saveTrackingState(trackingData);
  };

  // Filter projects and clients based on search query
  const searchResults = useMemo(() => {
    return TimeTrackerCalculationService.filterSearchResults(projects, searchQuery);
  }, [searchQuery, projects]);

  // Format time display using extracted service
  const formatTime = formatTimeSeconds;

  // Handle search selection
  const handleSelectItem = async (item: any) => {
    let selectedProjectData;
    
    if (item.type === 'project') {
      const project = projects.find(p => p.id === item.id);
      setSelectedProject(project);
      setSearchQuery(project ? `${project.name} • ${project.client}` : '');
      selectedProjectData = project;
    } else {
      // Client selected - use just client name
      const clientProject = { client: item.name, name: item.name };
      setSelectedProject(clientProject);
      setSearchQuery(item.name);
      selectedProjectData = clientProject;
    }
    setShowSearchDropdown(false);

    // Automatically start tracking if not already tracking
    if (!isTimeTracking) {
      const now = new Date();
      startTimeRef.current = now;
      setSeconds(0);
      setIsTimeTracking(true);
      
      // Create tracking event with distinctive styling
      const eventData = TimeTrackerCalculationService.createTrackingEventData(
        selectedProjectData,
        item.name,
        now
      );
      
      try {
        // Create the tracking event
        const createdEvent = await addEvent(eventData);
        
        // Use the actual event ID from the database
        setCurrentEventId(createdEvent.id);
        
        // Start the timer interval
        intervalRef.current = setInterval(() => {
          setSeconds(prev => prev + 1);
        }, 1000);
        
        // Start live updates immediately
        startLiveUpdates(createdEvent.id, now);
        
        // Handle any planned event overlaps
        handlePlannedEventOverlaps(now, new Date(now.getTime() + 60000));
        
        // Save tracking state
        saveTrackingState({
          isTracking: true,
          startTime: now,
          eventId: createdEvent.id,
          selectedProject: selectedProjectData,
          searchQuery: selectedProjectData?.name || item.name,
          affectedEvents: []
        });
        
      } catch (error) {
        console.error('Failed to create tracking event:', error);
        setIsTimeTracking(false);
        startTimeRef.current = null;
        return;
      }
    }
  };

  // Start/stop tracking
  const handleToggleTracking = async () => {
    if (!isTimeTracking) {
      // Start tracking
      if (!selectedProject && !searchQuery.trim()) {
        setShowSearchDropdown(true);
        return;
      }
      
      const now = new Date();
      startTimeRef.current = now;
      setSeconds(0);
      setIsTimeTracking(true);
      
      // Create tracking event with distinctive styling
      const eventData = TimeTrackerCalculationService.createTrackingEventData(
        selectedProject,
        searchQuery,
        now
      );
      
      try {
        // Create the tracking event
        const createdEvent = await addEvent(eventData);
        
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
        setIsTimeTracking(false);
        startTimeRef.current = null;
        return;
      }
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
      
    } else {
      // Stop tracking
      setIsTimeTracking(false);
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
        const duration = TimeTrackerCalculationService.calculateDurationInHours(startTimeRef.current, endTime);
        
        try {
          // Final update to the tracking event - mark as completed
          const completedEventData = TimeTrackerCalculationService.createCompletedEventData(
            selectedProject,
            searchQuery,
            startTimeRef.current,
            endTime,
            duration,
            seconds,
            formatTime
          );
          
          await updateEvent(currentEventId, completedEventData);
          
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

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };

    if (showSearchDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchDropdown]);

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
    <Card className={`bg-transparent shadow-none ${className}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Search Input with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <Input
              placeholder="What are you working on?"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              className="w-64 h-9 bg-background cursor-text"
              disabled={isTimeTracking}
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        
            {/* Dropdown */}
            {showSearchDropdown && (
              <div className="absolute top-full left-0 w-64 mt-1 bg-popover border border-border rounded-md shadow-lg z-50">
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
                              {item.type === 'project' && item.client 
                                ? `${item.name} • ${item.client}`
                                : item.name
                              }
                            </div>
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
              </div>
            )}
          </div>

          {/* Timer Display */}
          <div className="text-lg font-semibold tabular-nums text-[#595956] min-w-[5.5rem] text-center">
            {formatTime(seconds)}
          </div>

          {/* Play/Stop Button */}
          <Button
            onClick={handleToggleTracking}
            size="sm"
            className={`w-8 h-8 rounded-full p-0 transition-colors ${
              isTimeTracking 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
          >
            {isTimeTracking ? (
              <Square className="h-3 w-3" fill="currentColor" />
            ) : (
              <Play className="h-3 w-3 ml-0.5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}