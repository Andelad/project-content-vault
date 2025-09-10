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
import { 
  processEventOverlaps, 
  calculateElapsedTime, 
  createTimeRange,
  type EventSplitResult 
} from '@/services';
import { TimeTrackerCalculationService, timeTrackingService } from '@/services';
import { supabase } from '@/integrations/supabase/client';

interface TimeTrackerProps {
  className?: string;
}

export function TimeTracker({ className }: TimeTrackerProps) {
  console.log('🎭 TimeTracker component is rendering...');
  console.log('🔍 timeTrackingService:', timeTrackingService);
  
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
  const currentStateRef = useRef<any>(null); // Track current state for sync

  // Storage keys from service
  const STORAGE_KEYS = TimeTrackerCalculationService.getStorageKeys();

  // Load tracking state from localStorage and database on mount
  useEffect(() => {
    const loadTrackingState = async () => {
      // First try to load from database (authoritative source)
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const dbState = await timeTrackingService.loadState();
        if (dbState && dbState.isTracking && dbState.startTime && dbState.eventId) {
          // Use synced seconds if available, otherwise calculate from start time
          const elapsedSeconds = dbState.currentSeconds ?? 
            TimeTrackerCalculationService.calculateElapsedTime(dbState.startTime).totalSeconds;
          
          setIsTimeTracking(true);
          setSeconds(elapsedSeconds);
          setCurrentEventId(dbState.eventId);
          startTimeRef.current = dbState.startTime;
          
          // Store state for sync
          currentStateRef.current = {
            isTracking: true,
            startTime: dbState.startTime,
            eventId: dbState.eventId,
            selectedProject: dbState.selectedProject,
            searchQuery: dbState.searchQuery,
            affectedEvents: dbState.affectedEvents,
          };          if (dbState.selectedProject) {
            setSelectedProject(dbState.selectedProject);
          }
          
          if (dbState.searchQuery) {
            setSearchQuery(dbState.searchQuery);
          }

          if (dbState.affectedEvents) {
            setAffectedPlannedEvents(dbState.affectedEvents);
          }
          
          // Start the timer interval
          let syncCounter = 0;
          intervalRef.current = setInterval(() => {
            setSeconds(prev => {
              const newSeconds = prev + 1;
              
              // Sync timer state every 5 seconds to other windows
              syncCounter++;
              if (syncCounter >= 5 && currentStateRef.current) {
                syncCounter = 0;
                saveTrackingState({
                  ...currentStateRef.current,
                  currentSeconds: newSeconds,
                });
              }
              
              return newSeconds;
            });
          }, 1000);

          // Start live update interval
          startLiveUpdates(dbState.eventId, dbState.startTime);
          return;
        }
      }

      // Fallback to localStorage if no database state
      const trackingState = TimeTrackerCalculationService.loadTrackingState();
      
      if (trackingState && trackingState.startTime && trackingState.eventId) {
        const { totalSeconds: elapsedSeconds } = TimeTrackerCalculationService.calculateElapsedTime(trackingState.startTime);
        
        setIsTimeTracking(true);
        setSeconds(elapsedSeconds);
        setCurrentEventId(trackingState.eventId);
        startTimeRef.current = trackingState.startTime;
        
        // Store state for sync
        currentStateRef.current = {
          isTracking: true,
          startTime: trackingState.startTime,
          eventId: trackingState.eventId,
          selectedProject: trackingState.selectedProject,
          searchQuery: trackingState.searchQuery,
          affectedEvents: trackingState.affectedEvents,
        };
        
        if (trackingState.selectedProject) {
          setSelectedProject(trackingState.selectedProject);
        }
        
        if (trackingState.searchQuery) {
          setSearchQuery(trackingState.searchQuery);
        }

        if (trackingState.affectedEvents) {
          setAffectedPlannedEvents(trackingState.affectedEvents);
        }
        
        // Start the timer interval with cross-window sync
        let syncCounter = 0;
        intervalRef.current = setInterval(() => {
          setSeconds(prev => {
            const newSeconds = prev + 1;
            
            // Sync timer state every 5 seconds to other windows
            syncCounter++;
            if (syncCounter >= 5 && currentStateRef.current) {
              syncCounter = 0;
              saveTrackingState({
                ...currentStateRef.current,
                currentSeconds: newSeconds,
              });
            }
            
            return newSeconds;
          });
        }, 1000);

        // Start live update interval
        startLiveUpdates(trackingState.eventId, trackingState.startTime);
      }
    };

    loadTrackingState();

    // Set up cross-window timer sync listener
    const handleStateChange = (newState: any) => {
      console.log('📡 Received cross-window state change:', newState);
      
      if (newState.isTracking) {
        console.log('▶️ Other tab started tracking');
        
        // Sync to tracking state
        setIsTimeTracking(true);
        
        if (newState.currentSeconds !== undefined) {
          setSeconds(newState.currentSeconds);
        }
        
        if (newState.eventId) {
          setCurrentEventId(newState.eventId);
        }
        
        if (newState.startTime) {
          startTimeRef.current = new Date(newState.startTime);
        }
        
        // Update current state ref
        currentStateRef.current = {
          isTracking: true,
          startTime: newState.startTime ? new Date(newState.startTime) : null,
          eventId: newState.eventId,
          selectedProject: newState.selectedProject,
          searchQuery: newState.searchQuery,
          affectedEvents: newState.affectedEvents || []
        };
        
        // Start timer if not already running
        if (!intervalRef.current && newState.startTime) {
          let syncCounter = 0;
          intervalRef.current = setInterval(() => {
            setSeconds(prev => {
              const newSeconds = prev + 1;
              
              // Sync timer state every 5 seconds to other windows
              syncCounter++;
              if (syncCounter >= 5 && currentStateRef.current) {
                syncCounter = 0;
                saveTrackingState({
                  ...currentStateRef.current,
                  currentSeconds: newSeconds,
                });
              }
              
              return newSeconds;
            });
          }, 1000);
        }
        
      } else {
        console.log('⏹️ Other tab stopped tracking');
        
        // Stop tracking in this tab
        setIsTimeTracking(false);
        setSeconds(0);
        setCurrentEventId(null);
        startTimeRef.current = null;
        currentStateRef.current = null;
        
        // Clear intervals
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (liveUpdateIntervalRef.current) {
          clearInterval(liveUpdateIntervalRef.current);
          liveUpdateIntervalRef.current = null;
        }
      }
    };

    timeTrackingService.setOnStateChangeCallback(handleStateChange);

    return () => {
      // Cleanup listener
      timeTrackingService.setOnStateChangeCallback(undefined);
    };
  }, []); // Remove dependency on isTimeTracking to prevent multiple re-registrations

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
      // Keep completed: true during tracking
      updateEvent(eventId, {
        endTime: new Date(),
        duration,
        completed: true
      }, { silent: true });

      // Check for new overlaps as the event grows
      const affected = handlePlannedEventOverlaps(startTime, new Date());
      
      // Save affected events to localStorage
      localStorage.setItem(STORAGE_KEYS.affectedEvents, JSON.stringify(affected));
    }, 5000); // Update every 5 seconds
  };

  // Save tracking state to both localStorage and database with cross-window sync
  const saveTrackingState = async (trackingData: {
    isTracking: boolean;
    startTime?: Date;
    currentSeconds?: number;
    eventId?: string | null;
    selectedProject?: any;
    searchQuery?: string;
    affectedEvents?: string[];
  }) => {
    console.log('💾 saveTrackingState called with:', trackingData);
    
    // Save to localStorage (existing functionality)
    TimeTrackerCalculationService.saveTrackingState(trackingData);
    
    // Sync to database and other windows
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      console.log('🌐 About to call syncState...');
      try {
        await timeTrackingService.syncState({
          ...trackingData,
          lastUpdateTime: new Date()
        });
        console.log('✅ syncState completed');
      } catch (error) {
        console.error('❌ syncState failed:', error);
      }
    } else {
      console.log('⚠️ No user, skipping database sync');
    }
  };

  // Filter projects and clients based on search query
  const searchResults = useMemo(() => {
    return TimeTrackerCalculationService.filterSearchResults(projects, searchQuery);
  }, [searchQuery, projects]);

  // Format time display (simple inline function)
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
        
        // Store current state for sync
        currentStateRef.current = {
          isTracking: true,
          startTime: now,
          eventId: createdEvent.id,
          selectedProject: selectedProjectData,
          searchQuery: selectedProjectData?.name || item.name,
          affectedEvents: []
        };
        
        // Save tracking state
        await saveTrackingState({
          ...currentStateRef.current,
          currentSeconds: 0
        });
        
        // Start the timer interval with cross-window sync
        let syncCounter = 0;
        intervalRef.current = setInterval(() => {
          setSeconds(prev => {
            const newSeconds = prev + 1;
            
            // Sync timer state every 5 seconds to other windows
            syncCounter++;
            if (syncCounter >= 5 && currentStateRef.current) {
              syncCounter = 0;
              saveTrackingState({
                ...currentStateRef.current,
                currentSeconds: newSeconds,
              });
            }
            
            return newSeconds;
          });
        }, 1000);
        
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
        
        console.log('🔴 Creating tracking event:', eventData);
        
        try {
          // Create the tracking event
          const createdEvent = await addEvent(eventData);
          console.log('✅ Tracking event created:', createdEvent);
          
          // Use the actual event ID from the database
          setCurrentEventId(createdEvent.id);
        
        // Store current state for sync
        currentStateRef.current = {
          isTracking: true,
          startTime: now,
          eventId: createdEvent.id,
          selectedProject,
          searchQuery,
          affectedEvents: []
        };
        
        // Start live updates immediately
        startLiveUpdates(createdEvent.id, now);
        
        // Save tracking state
        await saveTrackingState({
          ...currentStateRef.current,
          currentSeconds: 0
        });
        
        // Start the timer interval with cross-window sync
        let syncCounter = 0;
        intervalRef.current = setInterval(() => {
          setSeconds(prev => {
            const newSeconds = prev + 1;
            
            // Sync timer state every 5 seconds to other windows
            syncCounter++;
            if (syncCounter >= 5 && currentStateRef.current) {
              syncCounter = 0;
              saveTrackingState({
                ...currentStateRef.current,
                currentSeconds: newSeconds,
              });
            }
            
            return newSeconds;
          });
        }, 1000);
        
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
      console.log('🛑 Stopping tracking in this tab');
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
      currentStateRef.current = null; // Clear state ref
      
      // Clear tracking state from localStorage and database
      console.log('💾 Saving stop state to sync across tabs');
      await saveTrackingState({ 
        isTracking: false,
        currentSeconds: 0
      });
      console.log('✅ Stop state saved');
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
            onClick={() => {
              console.log('🎬 BUTTON CLICKED - IMMEDIATE!');
              handleToggleTracking();
            }}
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