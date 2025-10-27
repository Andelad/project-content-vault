import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { UnifiedTimeTrackerService } from '@/services';

interface ProjectSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onProjectSelect: (project: any) => void;
  onAddProject?: () => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  className?: string;
  showAddButton?: boolean;
  selectedProjectId?: string; // Add this to track the selected project
}

export function ProjectSearchInput({
  value,
  onChange,
  onProjectSelect,
  onAddProject,
  disabled = false,
  label = "Search for Project or Client",
  placeholder = "Type to search projects or clients...",
  className = "",
  showAddButton = true,
  selectedProjectId
}: ProjectSearchInputProps) {
  const { projects } = useProjectContext();
  const { events } = usePlannerContext();
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProjectColor, setSelectedProjectColor] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Get the 3 most recently used projects based on events
  const recentProjects = useMemo(() => {
    // Get unique project IDs from events, sorted by most recent
    const projectIds = events
      .filter(event => event.projectId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .map(event => event.projectId)
      .filter((id, index, self) => self.indexOf(id) === index) // Remove duplicates
      .slice(0, 3); // Take top 3

    // Map project IDs to full project objects
    return projectIds
      .map(id => projects.find(p => p.id === id))
      .filter(Boolean); // Remove undefined values
  }, [events, projects]);

  // Update color when selectedProjectId changes
  useEffect(() => {
    if (selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (project) {
        setSelectedProjectColor(project.color);
      }
    } else {
      setSelectedProjectColor(null);
    }
  }, [selectedProjectId, projects]);

  // Filter projects and clients based on search query
  const searchResults = useMemo(() => {
    if (!value.trim()) {
      // When there's no search query, show recent projects
      return recentProjects.map(project => ({
        id: project.id,
        name: project.name,
        client: project.client,
        type: 'project' as const
      }));
    }
    return UnifiedTimeTrackerService.filterSearchResults(projects, value);
  }, [value, projects, recentProjects]);

  // Handle search selection
  const handleSelectItem = (item: any) => {
    if (item.type === 'project') {
      const project = projects.find(p => p.id === item.id);
      if (project) {
        onProjectSelect(project);
        const displayText = project.client 
          ? `${project.name} • ${project.client}` 
          : project.name;
        onChange(displayText);
        setSelectedProjectColor(project.color);
      }
    } else {
      // Client selected - create a client-only object
      const clientProject = { client: item.name, name: item.name };
      onProjectSelect(clientProject);
      onChange(item.name);
      setSelectedProjectColor(null);
    }
    setShowDropdown(false);
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <Label>{label}</Label>}
      <div className="relative" ref={dropdownRef}>
        {selectedProjectColor && (
          <div 
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 rounded-full border border-gray-300 z-10 pointer-events-none"
            style={{ backgroundColor: selectedProjectColor }}
          />
        )}
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowDropdown(true);
            // Clear the selected color when user starts typing
            if (selectedProjectColor) {
              setSelectedProjectColor(null);
            }
          }}
          onFocus={() => setShowDropdown(true)}
          className={`w-full pr-10 ${selectedProjectColor ? 'pl-8' : ''}`}
          disabled={disabled}
        />
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        
        {/* Dropdown */}
        {showDropdown && !disabled && (
          <div className="absolute top-full left-0 w-full mt-1 bg-popover border border-border rounded-md shadow-lg z-[100]">
            <div className="max-h-64 overflow-y-auto">
              {searchResults.length > 0 ? (
                <>
                  {searchResults.map((item) => (
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
                  ))}
                  {showAddButton && onAddProject && (
                    <button
                      className="w-full px-3 py-2 text-left hover:bg-accent/50 border-t border-border flex items-center gap-2 text-primary"
                      onClick={() => {
                        setShowDropdown(false);
                        onAddProject();
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">Create New</span>
                    </button>
                  )}
                </>
              ) : value.trim() ? (
                <>
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    No projects or clients found
                  </div>
                  {showAddButton && onAddProject && (
                    <button
                      className="w-full px-3 py-2 text-left hover:bg-accent/50 border-t border-border flex items-center gap-2 text-primary"
                      onClick={() => {
                        setShowDropdown(false);
                        onAddProject();
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">Create New</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    Start typing to search projects and clients
                  </div>
                  {showAddButton && onAddProject && (
                    <button
                      className="w-full px-3 py-2 text-left hover:bg-accent/50 border-t border-border flex items-center gap-2 text-primary"
                      onClick={() => {
                        setShowDropdown(false);
                        onAddProject();
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">Create New</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
