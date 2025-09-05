import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Search, X, Folder, FileText } from 'lucide-react';
import { CalendarEvent, Group, Project } from '../../types';
import { ScrollArea } from '../ui/scroll-area';

interface FilterRule {
  id: string;
  type: 'group' | 'project';
  groupIds?: string[];
  projectIds?: string[];
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  projects: Project[];
  filterRules: FilterRule[];
  onFilterRulesChange: (rules: FilterRule[]) => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  groups,
  projects,
  filterRules,
  onFilterRulesChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  // Initialize selected items from existing filter rules
  React.useEffect(() => {
    if (isOpen) {
      const groupRule = filterRules.find(rule => rule.type === 'group');
      const projectRule = filterRules.find(rule => rule.type === 'project');
      
      setSelectedGroupIds(groupRule?.groupIds || []);
      setSelectedProjectIds(projectRule?.projectIds || []);
    }
  }, [isOpen, filterRules]);

  // Filter projects based on search term and selected groups
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Filter by selected groups if any
    if (selectedGroupIds.length > 0) {
      filtered = filtered.filter(project => 
        selectedGroupIds.includes(project.groupId)
      );
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [projects, selectedGroupIds, searchTerm]);

  const handleGroupToggle = (groupId: string, checked: boolean) => {
    if (checked) {
      setSelectedGroupIds(prev => [...prev, groupId]);
    } else {
      setSelectedGroupIds(prev => prev.filter(id => id !== groupId));
      // Also remove projects from this group
      const groupProjects = projects
        .filter(project => project.groupId === groupId)
        .map(project => project.id);
      setSelectedProjectIds(prev => 
        prev.filter(id => !groupProjects.includes(id))
      );
    }
  };

  const handleProjectToggle = (projectId: string, checked: boolean) => {
    if (checked) {
      setSelectedProjectIds(prev => [...prev, projectId]);
    } else {
      setSelectedProjectIds(prev => prev.filter(id => id !== projectId));
    }
  };

  const handleApply = () => {
    const newRules: FilterRule[] = [];
    
    if (selectedGroupIds.length > 0) {
      newRules.push({
        id: 'groups',
        type: 'group',
        groupIds: selectedGroupIds
      });
    }
    
    if (selectedProjectIds.length > 0) {
      newRules.push({
        id: 'projects',
        type: 'project',
        projectIds: selectedProjectIds
      });
    }
    
    onFilterRulesChange(newRules);
    onClose();
  };

  const handleClear = () => {
    setSelectedGroupIds([]);
    setSelectedProjectIds([]);
    onFilterRulesChange([]);
    onClose();
  };

  const getGroupName = (groupId: string) => {
    return groups.find(g => g.id === groupId)?.name || 'Unknown Group';
  };

  const getProjectName = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.name || 'Unknown Project';
  };

  const totalSelected = selectedGroupIds.length + selectedProjectIds.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Filter Heatmap Data</DialogTitle>
          <DialogDescription>
            Select groups and projects to include in the heatmap analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Selected Filters Summary */}
          {totalSelected > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Selected Filters ({totalSelected})</h4>
              <div className="flex flex-wrap gap-2">
                {selectedGroupIds.map(groupId => (
                  <Badge key={groupId} variant="secondary" className="flex items-center gap-1">
                    <Folder className="h-3 w-3" />
                    {getGroupName(groupId)}
                    <X
                      className="h-3 w-3 cursor-pointer hover:bg-gray-200 rounded"
                      onClick={() => handleGroupToggle(groupId, false)}
                    />
                  </Badge>
                ))}
                {selectedProjectIds.map(projectId => (
                  <Badge key={projectId} variant="secondary" className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {getProjectName(projectId)}
                    <X
                      className="h-3 w-3 cursor-pointer hover:bg-gray-200 rounded"
                      onClick={() => handleProjectToggle(projectId, false)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Groups Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Groups</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {groups.map(group => (
                <label
                  key={group.id}
                  className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                >
                  <Checkbox
                    checked={selectedGroupIds.includes(group.id)}
                    onCheckedChange={(checked) => handleGroupToggle(group.id, !!checked)}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <Folder className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{group.name}</span>
                    <span className="text-xs text-gray-500">
                      ({projects.filter(p => p.groupId === group.id).length} projects)
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Projects Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Projects</h4>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-60"
                />
              </div>
            </div>
            
            <ScrollArea className="max-h-60">
              <div className="space-y-2">
                {filteredProjects.map(project => {
                  const group = groups.find(g => g.id === project.groupId);
                  return (
                    <label
                      key={project.id}
                      className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    >
                      <Checkbox
                        checked={selectedProjectIds.includes(project.id)}
                        onCheckedChange={(checked) => handleProjectToggle(project.id, !!checked)}
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <div className="flex-1">
                          <div className="text-sm">{project.name}</div>
                          {group && (
                            <div className="text-xs text-gray-500">{group.name}</div>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
                {filteredProjects.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No projects found
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClear}>
            Clear All
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply Filters ({totalSelected})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
