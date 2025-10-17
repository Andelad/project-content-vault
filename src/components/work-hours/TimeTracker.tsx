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
import { UnifiedTimeTrackerService } from '@/services';
import type { TimeTrackerWorkflowContext } from '@/services/orchestrators/timeTrackingOrchestrator';
import { supabase } from '@/integrations/supabase/client';
import { ConflictDialog } from './ConflictDialog';
import type { TimeTrackingState } from '@/types/timeTracking';
import { toast } from '@/hooks/use-toast';
interface TimeTrackerProps {
  className?: string;
}
export function TimeTracker({ className }: TimeTrackerProps) {
  const { projects } = useProjectContext();
  const { events, addEvent, updateEvent, deleteEvent } = usePlannerContext();
  const { isTimeTracking, setIsTimeTracking, currentTrackingEventId, setCurrentTrackingEventId: setGlobalTrackingEventId } = useSettingsContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [seconds, setSeconds] = useState(0);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [affectedPlannedEvents, setAffectedPlannedEvents] = useState<string[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictingSession, setConflictingSession] = useState<TimeTrackingState | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null); // UI timer (1s)
  const dbSyncIntervalRef = useRef<NodeJS.Timeout | null>(null); // DB sync (30s)
  const overlapCheckIntervalRef = useRef<NodeJS.Timeout | null>(null); // Overlap check (60s)
  const startTimeRef = useRef<Date | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const currentStateRef = useRef<any>(null); // Track current state for sync
  // Storage keys from service
  const STORAGE_KEYS = UnifiedTimeTrackerService.getStorageKeys();
    // Load tracking state from database on mount - REVERTED TO WORKING PRE-ORCHESTRATION APPROACH
  useEffect(() => {
    // // console.log('🔍 TIMETRACKER - Mount: Loading state from Supabase only');
    
    // Clear legacy localStorage data (one-time migration)
    localStorage.removeItem('timeTracker_crossWindowSync');
    
    const loadTrackingState = async () => {
      // Load from Supabase (only source of truth)
      const dbState = await UnifiedTimeTrackerService.loadState();
      
      // // console.log('🔍 TIMETRACKER - Loaded state:', {
      //   hasState: !!dbState,
      //   isTracking: dbState?.isTracking,
      //   eventId: dbState?.eventId,
      //   selectedProject: dbState?.selectedProject?.name,
      //   startTime: dbState?.startTime
      // });
      
      // Only restore if we have COMPLETE tracking state
      const hasCompleteState = dbState && 
                                dbState.isTracking && 
                                dbState.startTime && 
                                dbState.eventId && 
                                dbState.selectedProject;
      
      if (hasCompleteState) {
        // Calculate elapsed time
        const elapsedSeconds = dbState.currentSeconds ?? 
          Math.floor((Date.now() - new Date(dbState.startTime).getTime()) / 1000);
        
        // Restore all state
        setIsTimeTracking(true);
        setSeconds(elapsedSeconds);
        setCurrentEventId(dbState.eventId);
        startTimeRef.current = new Date(dbState.startTime);
        
        // Restore UI state
        if (dbState.selectedProject) setSelectedProject(dbState.selectedProject);
        if (dbState.searchQuery) setSearchQuery(dbState.searchQuery);
        if (dbState.affectedEvents) setAffectedPlannedEvents(dbState.affectedEvents);
        
        // Store state for sync
        currentStateRef.current = {
          isTracking: true,
          startTime: new Date(dbState.startTime),
          eventId: dbState.eventId,
          selectedProject: dbState.selectedProject,
          searchQuery: dbState.searchQuery,
          affectedEvents: dbState.affectedEvents || []
        };
        
        // Start UI timer (1 second updates)
        intervalRef.current = setInterval(() => {
          if (startTimeRef.current) {
            const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
            setSeconds(elapsed);
          }
        }, 1000);
        
        // Start background sync intervals
        startOptimizedIntervals(dbState.eventId, new Date(dbState.startTime));
        
        // // console.log('✅ TIMETRACKER - Restored active tracking session');
      } else if (dbState && dbState.isTracking) {
        // Incomplete state - clean it up
        console.warn('⚠️ TIMETRACKER - Incomplete tracking state, will be cleaned up');
      } else {
        // // console.log('✅ TIMETRACKER - No active tracking session');
      }
    };
    
    loadTrackingState();
  }, []); // Only run once on mount

  // React to global state changes - CROSS-WINDOW SYNC
  useEffect(() => {
    // // console.log('🔍 CROSS-WINDOW SYNC - Effect triggered:', { 
    //   isTimeTracking, 
    //   currentTrackingEventId,
    //   hasCurrentState: !!currentStateRef.current,
    //   hasInterval: !!intervalRef.current 
    // });
    
    const syncWithGlobalState = async () => {
      if (isTimeTracking && currentTrackingEventId) {
        // If tracking is active but we don't have local state, load it
        if (!selectedProject || !currentStateRef.current || !intervalRef.current) {
          // // console.log('🔍 CROSS-WINDOW SYNC - Loading state from DB');
          const dbState = await UnifiedTimeTrackerService.loadState();
          
          if (dbState && dbState.selectedProject) {
            // Restore UI state
            setSelectedProject(dbState.selectedProject);
            setSearchQuery(dbState.searchQuery || '');
            setCurrentEventId(dbState.eventId || currentTrackingEventId);
            
            // Calculate and set elapsed time
            if (dbState.startTime) {
              const startTime = new Date(dbState.startTime);
              const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
              setSeconds(elapsed);
              startTimeRef.current = startTime;
              
              // START intervals if not running
              if (!intervalRef.current) {
                // // console.log('🔍 CROSS-WINDOW SYNC - Starting UI interval');
                intervalRef.current = setInterval(() => {
                  if (startTimeRef.current) {
                    const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
                    setSeconds(elapsed);
                  }
                }, 1000);
              }
              
              if (!dbSyncIntervalRef.current || !overlapCheckIntervalRef.current) {
                // // console.log('🔍 CROSS-WINDOW SYNC - Starting optimized intervals');
                startOptimizedIntervals(currentTrackingEventId, startTime);
              }
            }
            
            // Update state ref
            currentStateRef.current = {
              isTracking: true,
              eventId: currentTrackingEventId,
              startTime: dbState.startTime,
              selectedProject: dbState.selectedProject,
              searchQuery: dbState.searchQuery,
              affectedEvents: dbState.affectedEvents || []
            };
            
            if (dbState.affectedEvents) {
              setAffectedPlannedEvents(dbState.affectedEvents);
            }
          }
        }
      } else if (!isTimeTracking) {
        // Tracking stopped - ALWAYS clear intervals regardless of currentStateRef
        // // console.log('🔍 CROSS-WINDOW SYNC - Tracking stopped, clearing everything');
        
        setSelectedProject(null);
        setSearchQuery('');
        setSeconds(0);
        setCurrentEventId(null);
        startTimeRef.current = null;
        currentStateRef.current = null;
        setAffectedPlannedEvents([]);
        
        // Clear all intervals - CRITICAL FIX: Always clear when tracking stops
        if (intervalRef.current) {
          // // console.log('🔍 CROSS-WINDOW SYNC - Clearing UI interval');
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (dbSyncIntervalRef.current) {
          // // console.log('🔍 CROSS-WINDOW SYNC - Clearing DB sync interval');
          clearInterval(dbSyncIntervalRef.current);
          dbSyncIntervalRef.current = null;
        }
        if (overlapCheckIntervalRef.current) {
          // // console.log('🔍 CROSS-WINDOW SYNC - Clearing overlap check interval');
          clearInterval(overlapCheckIntervalRef.current);
          overlapCheckIntervalRef.current = null;
        }
      }
    };
    
    syncWithGlobalState();
  }, [isTimeTracking, currentTrackingEventId]); // React to global state changes
  // Check for overlapping planned events and adjust them
  const handlePlannedEventOverlaps = (trackingStart: Date, trackingEnd: Date) => {
    const affectedEvents = UnifiedTimeTrackerService.handlePlannedEventOverlaps(
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
  // Start optimized intervals for tracking event
  // Separate UI updates, DB syncs, and overlap checks for efficiency
  const startOptimizedIntervals = (eventId: string, startTime: Date) => {
    // // console.log('🔍 Starting optimized intervals for event:', eventId);
    
    // Clear any existing intervals
    if (dbSyncIntervalRef.current) {
      clearInterval(dbSyncIntervalRef.current);
    }
    if (overlapCheckIntervalRef.current) {
      clearInterval(overlapCheckIntervalRef.current);
    }
    
    // DB Sync: Update database every 30 seconds
    dbSyncIntervalRef.current = setInterval(async () => {
      const { duration } = UnifiedTimeTrackerService.calculateElapsedTime(startTime);
      // // console.log('💾 DB sync - updating event:', eventId, 'duration:', duration);
      
      try {
        // First verify the event still exists
        const { data: eventExists } = await supabase
          .from('calendar_events')
          .select('id')
          .eq('id', eventId)
          .maybeSingle();
        
        if (!eventExists) {
          console.error('💾 DB sync - EVENT DOES NOT EXIST IN DATABASE!', {
            eventId,
            currentSeconds: seconds
          });
          console.error('💾 DB sync - Stopping intervals and resetting state');
          
          // Clear all intervals
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (dbSyncIntervalRef.current) clearInterval(dbSyncIntervalRef.current);
          if (overlapCheckIntervalRef.current) clearInterval(overlapCheckIntervalRef.current);
          
          // Reset state
          setCurrentEventId(null);
          setIsTimeTracking(false);
          setSeconds(0);
          startTimeRef.current = null;
          
          return;
        }
        
        await updateEvent(eventId, {
          endTime: new Date(),
          duration,
          completed: true
        }, { silent: true });
        // // console.log('💾 DB sync - success');
      } catch (error: any) {
        console.error('💾 DB sync - failed:', error);
      }
    }, 30000); // 30 seconds
    
    // Overlap Check: Check for overlaps every 60 seconds
    overlapCheckIntervalRef.current = setInterval(() => {
      // // console.log('🔍 Overlap check - running');
      const affected = handlePlannedEventOverlaps(startTime, new Date());
      localStorage.setItem(STORAGE_KEYS.affectedEvents, JSON.stringify(affected));
      // // console.log('🔍 Overlap check - complete, affected events:', affected.length);
    }, 60000); // 60 seconds
    
    // Run initial checks immediately
    setTimeout(() => {
      handlePlannedEventOverlaps(startTime, new Date());
    }, 1000); // Wait 1 second after start
  };
  
  // Filter projects and clients based on search query
  const searchResults = useMemo(() => {
    return UnifiedTimeTrackerService.filterSearchResults(projects, searchQuery);
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
    let searchQueryText;
    
    if (item.type === 'project') {
      const project = projects.find(p => p.id === item.id);
      setSelectedProject(project);
      searchQueryText = project ? `${project.name} • ${project.client}` : '';
      setSearchQuery(searchQueryText);
      selectedProjectData = project;
    } else {
      // Client selected - use just client name
      const clientProject = { client: item.name, name: item.name };
      setSelectedProject(clientProject);
      searchQueryText = item.name;
      setSearchQuery(searchQueryText);
      selectedProjectData = clientProject;
    }
    setShowSearchDropdown(false);
    
    // Automatically start tracking if not already tracking
    // Use the orchestrator workflow to ensure proper state management
    if (!isTimeTracking && selectedProjectData) {
      // Check for active session conflict before starting
      const activeSession = await UnifiedTimeTrackerService.checkForActiveSession();
      
      if (activeSession) {
        // Show conflict dialog instead of starting
        setConflictingSession(activeSession);
        setShowConflictDialog(true);
        return;
      }
      
      // Create context with the selected project data directly (don't wait for state update)
      const context: TimeTrackerWorkflowContext = {
        selectedProject: selectedProjectData,
        searchQuery: searchQueryText,
        addEvent,
        setCurrentEventId,
        setIsTimeTracking,
        setSeconds,
        setSelectedProject,
        setSearchQuery,
        startTimeRef,
        intervalRef,
        currentStateRef
      };

      const result = await UnifiedTimeTrackerService.handleTimeTrackingToggle(context);
      
      if (!result.success && result.error) {
        console.error('Time tracking toggle failed:', result.error);
        return;
      }

      // Handle post-toggle actions for start tracking
      if (result.eventId) {
        // Update global tracking event ID
        setGlobalTrackingEventId(result.eventId);
        // Start optimized intervals immediately
        startOptimizedIntervals(result.eventId, startTimeRef.current || new Date());
      }
    }
  };
  // Start/stop tracking
  const handleToggleTracking = async () => {
    // Validate project selection for start tracking
    if (!isTimeTracking && !selectedProject && !searchQuery.trim()) {
      setShowSearchDropdown(true);
      return;
    }

    // Check for active session conflict before starting
    if (!isTimeTracking) {
      const activeSession = await UnifiedTimeTrackerService.checkForActiveSession();
      
      if (activeSession) {
        // Show conflict dialog instead of starting
        setConflictingSession(activeSession);
        setShowConflictDialog(true);
        return;
      }
    }

    const context: TimeTrackerWorkflowContext = {
      selectedProject,
      searchQuery,
      addEvent,
      setCurrentEventId,
      setIsTimeTracking,
      setSeconds,
      setSelectedProject,
      setSearchQuery,
      startTimeRef,
      intervalRef,
      currentStateRef
    };

    const result = await UnifiedTimeTrackerService.handleTimeTrackingToggle(context);
    
    if (!result.success && result.error) {
      console.error('Time tracking toggle failed:', result.error);
      
      // If we were trying to stop tracking and it failed, force reset everything
      if (isTimeTracking) {
        console.warn('Force resetting time tracking state due to error');
        
        // Clear all intervals
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (dbSyncIntervalRef.current) {
          clearInterval(dbSyncIntervalRef.current);
          dbSyncIntervalRef.current = null;
        }
        if (overlapCheckIntervalRef.current) {
          clearInterval(overlapCheckIntervalRef.current);
          overlapCheckIntervalRef.current = null;
        }
        
        // Reset all state
        setCurrentEventId(null);
        setIsTimeTracking(false);
        setSeconds(0);
        startTimeRef.current = null;
        currentStateRef.current = null;
        setSelectedProject(null);
        setSearchQuery('');
        setAffectedPlannedEvents([]);
        
        // Clear storage
        await UnifiedTimeTrackerService.stopTracking().catch(err => {
          console.error('Failed to clear storage:', err);
        });
      }
      return;
    }

    // Handle post-toggle actions for start tracking
    if (result.eventId && !isTimeTracking) {
      // Update global tracking event ID
      setGlobalTrackingEventId(result.eventId);
      // Start optimized intervals immediately
      startOptimizedIntervals(result.eventId, startTimeRef.current || new Date());
    }

    // Handle post-toggle actions for stop tracking
    if (!result.eventId && isTimeTracking) {
      // Clear global tracking event ID
      setGlobalTrackingEventId(null);
      // Clear all tracking intervals
      if (dbSyncIntervalRef.current) {
        clearInterval(dbSyncIntervalRef.current);
        dbSyncIntervalRef.current = null;
      }
      if (overlapCheckIntervalRef.current) {
        clearInterval(overlapCheckIntervalRef.current);
        overlapCheckIntervalRef.current = null;
      }

      // Handle final event completion logic
      if (currentEventId && startTimeRef.current) {
        const endTime = new Date();
        const duration = UnifiedTimeTrackerService.calculateDurationInHours(startTimeRef.current, endTime);
        
        try {
          const completedEventData = UnifiedTimeTrackerService.createCompletedEventData(
            selectedProject,
            searchQuery,
            startTimeRef.current,
            endTime,
            duration,
            seconds,
            formatTime
          );
          await updateEvent(currentEventId, completedEventData);
          handlePlannedEventOverlaps(startTimeRef.current, endTime);
        } catch (error) {
          console.error('Failed to complete tracking event:', error);
        }
      }

      // Reset UI state
      setSelectedProject(null);
      setSearchQuery('');
      setAffectedPlannedEvents([]);
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
      if (dbSyncIntervalRef.current) {
        clearInterval(dbSyncIntervalRef.current);
      }
      if (overlapCheckIntervalRef.current) {
        clearInterval(overlapCheckIntervalRef.current);
      }
    };
  }, []);
  
  // Conflict resolution handlers
  const handleCancelConflict = () => {
    setShowConflictDialog(false);
    
    // Load the conflicting session state to show the active tracker
    if (conflictingSession) {
      setSelectedProject(conflictingSession.selectedProject);
      setSearchQuery(conflictingSession.searchQuery || '');
      setIsTimeTracking(conflictingSession.isTracking);
      setCurrentEventId(conflictingSession.eventId);
      
      if (conflictingSession.startTime) {
        startTimeRef.current = conflictingSession.startTime;
        const elapsed = Math.floor((Date.now() - conflictingSession.startTime.getTime()) / 1000);
        setSeconds(elapsed);
      }
    }
  };

  const handleStopAndStartNew = async () => {
    setShowConflictDialog(false);
    
    try {
      // Stop the existing session - this will save it to the calendar
      await UnifiedTimeTrackerService.stopTracking();
      
      // Small delay to ensure state is cleared
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now start tracking the new project
      if (selectedProject) {
        await handleToggleTracking();
      }
    } catch (error) {
      console.error('Error stopping and starting new session:', error);
      toast({
        title: "Error",
        description: "Failed to switch tracking sessions. Please try again.",
        variant: "destructive"
      });
    }
  };

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

        {conflictingSession && (
          <ConflictDialog
            isOpen={showConflictDialog}
            onClose={handleCancelConflict}
            activeSession={conflictingSession}
            onStopAndStart={handleStopAndStartNew}
          />
        )}
      </CardContent>
    </Card>
  );
}