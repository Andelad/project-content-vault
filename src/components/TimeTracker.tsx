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
  const { projects } = useAppDataOnly();
  const { addEvent, updateEvent } = useAppActionsOnly();
  
  const [isTracking, setIsTracking] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [seconds, setSeconds] = useState(0);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

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
      
      // Create initial event
      const eventData: Omit<CalendarEvent, 'id'> = {
        title: selectedProject?.name || searchQuery || 'Time Tracking',
        startTime: now,
        endTime: new Date(now.getTime() + 60000), // Start with 1 minute
        projectId: selectedProject?.id,
        color: selectedProject?.color || '#8B5CF6',
        description: selectedProject ? `Tracking time for ${selectedProject.name}` : undefined
      };
      
      try {
        await addEvent(eventData);
        // For now, we'll generate a temporary ID for tracking
        // This will be replaced when we get the actual event ID from the database
        const tempId = `tracking-${Date.now()}`;
        setCurrentEventId(tempId);
      } catch (error) {
        console.error('Failed to create tracking event:', error);
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
      
      // Update final event end time
      if (currentEventId && startTimeRef.current) {
        const endTime = new Date();
        const duration = (endTime.getTime() - startTimeRef.current.getTime()) / (1000 * 60 * 60); // hours
        
        try {
          await updateEvent(currentEventId, {
            endTime,
            duration
          });
        } catch (error) {
          console.error('Failed to update tracking event:', error);
        }
      }
      
      // Reset everything
      setCurrentEventId(null);
      startTimeRef.current = null;
      setSeconds(0);
      setSelectedProject(null);
      setSearchQuery('');
    }
  };

  // Update live event every 10 seconds while tracking
  useEffect(() => {
    if (!isTracking || !currentEventId || !startTimeRef.current) return;
    
    const updateInterval = setInterval(async () => {
      const now = new Date();
      const duration = (now.getTime() - startTimeRef.current!.getTime()) / (1000 * 60 * 60);
      
      try {
        await updateEvent(currentEventId, {
          endTime: now,
          duration
        });
      } catch (error) {
        console.error('Failed to update live tracking event:', error);
      }
    }, 10000); // Update every 10 seconds
    
    return () => clearInterval(updateInterval);
  }, [isTracking, currentEventId, updateEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
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