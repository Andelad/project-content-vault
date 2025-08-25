import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle, Calendar as CalendarIcon } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { useApp } from '../contexts/AppContext';
import { Milestone } from '@/types/core';

interface MilestoneManagerProps {
  projectId?: string; // Made optional to support new projects
  projectEstimatedHours: number;
  projectStartDate: Date;
  projectEndDate: Date;
  onUpdateProjectBudget?: (newBudget: number) => void;
  // For new projects, we need local state management
  localMilestonesState?: {
    milestones: LocalMilestone[];
    setMilestones: (milestones: LocalMilestone[]) => void;
  };
  isCreatingProject?: boolean;
}

interface LocalMilestone extends Omit<Milestone, 'id'> {
  id?: string;
  isNew?: boolean;
}

export function MilestoneManager({ 
  projectId, 
  projectEstimatedHours, 
  projectStartDate,
  projectEndDate,
  onUpdateProjectBudget,
  localMilestonesState,
  isCreatingProject = false
}: MilestoneManagerProps) {
  const { milestones, addMilestone, updateMilestone, deleteMilestone, showMilestoneSuccessToast } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);
  const [localMilestones, setLocalMilestones] = useState<LocalMilestone[]>([]);
  const [editingProperty, setEditingProperty] = useState<string | null>(null);

  // Helper function to show error toast
  const showErrorToast = async (message: string) => {
    const { toast } = await import('@/hooks/use-toast');
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    });
  };

  // Helper function to check if milestone allocation would exceed budget
  const wouldExceedBudget = (milestoneId: string, newTimeAllocation: number) => {
    const currentMilestone = projectMilestones.find(m => m.id === milestoneId);
    const otherMilestonesTotal = projectMilestones
      .filter(m => m.id !== milestoneId)
      .reduce((total, m) => total + m.timeAllocation, 0);
    
    return (otherMilestonesTotal + newTimeAllocation) > projectEstimatedHours;
  };

  // Helper function to handle property saving for milestones
  const handleSaveMilestoneProperty = async (milestoneId: string, property: string, value: any) => {
    // Check if this is a time allocation update that would exceed budget
    if (property === 'timeAllocation') {
      if (wouldExceedBudget(milestoneId, value)) {
        await showErrorToast(`Cannot save milestone: Total milestone allocation (${Math.ceil(projectMilestones.reduce((total, m) => total + (m.id === milestoneId ? value : m.timeAllocation), 0))}h) would exceed project budget (${projectEstimatedHours}h).`);
        setEditingProperty(null);
        return;
      }
    }

    if (isCreatingProject && localMilestonesState) {
      // For new projects, update local state
      const updatedMilestones = localMilestonesState.milestones.map(m =>
        m.id === milestoneId ? { ...m, [property]: value } : m
      );
      localMilestonesState.setMilestones(updatedMilestones);
    } else {
      // Check if this is a new milestone that needs to be saved first
      const localMilestone = localMilestones.find(m => m.id === milestoneId);
      if (localMilestone && localMilestone.isNew && projectId) {
        // Check budget before saving new milestone
        const totalWithNewMilestone = projectMilestones.reduce((total, m) => total + m.timeAllocation, 0) + 
          (property === 'timeAllocation' ? value : localMilestone.timeAllocation);
        
        if (totalWithNewMilestone > projectEstimatedHours) {
          await showErrorToast(`Cannot save milestone: Total milestone allocation (${Math.ceil(totalWithNewMilestone)}h) would exceed project budget (${projectEstimatedHours}h).`);
          setEditingProperty(null);
          return;
        }

        // Save the new milestone to database first
        try {
          const savedMilestone = await addMilestone({
            name: localMilestone.name,
            dueDate: localMilestone.dueDate,
            timeAllocation: localMilestone.timeAllocation,
            projectId: projectId,
            order: localMilestone.order,
            [property]: value // Apply the new property value
          });
          
          // Remove from local state since it's now saved
          setLocalMilestones(prev => prev.filter(m => m.id !== milestoneId));
        } catch (error) {
          console.error('Failed to save new milestone:', error);
          await showErrorToast('Failed to save milestone. Please try again.');
          setEditingProperty(null);
          return;
        }
      } else if (projectId) {
        // For existing milestones, update in database
        try {
          await updateMilestone(milestoneId, { [property]: value });
        } catch (error) {
          console.error('Failed to update milestone:', error);
          await showErrorToast('Failed to update milestone. Please try again.');
          setEditingProperty(null);
          return;
        }
      }
    }
    setEditingProperty(null);
  };

  // Inline editing components similar to ProjectDetailModal
  const MilestoneNameField = ({ 
    milestone, 
    property = 'name' 
  }: {
    milestone: Milestone | LocalMilestone;
    property?: string;
  }) => {
    const isEditing = editingProperty === `${milestone.id}-${property}`;
    const displayValue = milestone.name || 'Milestone name';
    
    return (
      <div className="min-w-[120px]">
        <Label className="text-xs text-muted-foreground mb-1 block">Name</Label>
        {isEditing ? (
          <Input
            type="text"
            defaultValue={milestone.name}
            placeholder="Milestone name"
            className="h-10 text-sm border-border bg-background"
            style={{ width: `${Math.max(displayValue.length * 8 + 40, 120)}px` }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const newValue = (e.target as HTMLInputElement).value;
                handleSaveMilestoneProperty(milestone.id!, property, newValue);
              } else if (e.key === 'Escape') {
                setEditingProperty(null);
              }
            }}
            onBlur={(e) => {
              const newValue = e.target.value;
              handleSaveMilestoneProperty(milestone.id!, property, newValue);
            }}
            autoFocus
          />
        ) : (
          <Button
            variant="outline"
            className="h-10 text-sm justify-start text-left font-normal px-3"
            style={{ width: `${Math.max(displayValue.length * 8 + 40, 120)}px` }}
            onClick={() => setEditingProperty(`${milestone.id}-${property}`)}
          >
            {displayValue}
          </Button>
        )}
      </div>
    );
  };

  const MilestoneBudgetField = ({ 
    milestone, 
    property = 'timeAllocation' 
  }: {
    milestone: Milestone | LocalMilestone;
    property?: string;
  }) => {
    const isEditing = editingProperty === `${milestone.id}-${property}`;
    const displayValue = `${milestone.timeAllocation}h`;
    
    return (
      <div className="min-w-[80px]">
        <Label className="text-xs text-muted-foreground mb-1 block">Time Budget</Label>
        <div className="flex items-center gap-1">
          {isEditing ? (
            <Input
              type="number"
              defaultValue={milestone.timeAllocation}
              className="h-10 text-sm border-border bg-background"
              style={{ width: `${Math.max(milestone.timeAllocation.toString().length * 12 + 60, 80)}px` }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const newValue = parseFloat((e.target as HTMLInputElement).value) || 0;
                  handleSaveMilestoneProperty(milestone.id!, property, newValue);
                } else if (e.key === 'Escape') {
                  setEditingProperty(null);
                }
              }}
              onBlur={(e) => {
                const newValue = parseFloat(e.target.value) || 0;
                handleSaveMilestoneProperty(milestone.id!, property, newValue);
              }}
              autoFocus
            />
          ) : (
            <Button
              variant="outline"
              className="h-10 text-sm justify-start text-left font-normal px-3"
              style={{ width: `${Math.max(displayValue.length * 8 + 40, 80)}px` }}
              onClick={() => setEditingProperty(`${milestone.id}-${property}`)}
            >
              {displayValue}
            </Button>
          )}
          <span className="text-xs text-muted-foreground/60">of {projectEstimatedHours}h</span>
        </div>
      </div>
    );
  };

  const MilestoneDateField = ({ 
    milestone, 
    property = 'dueDate' 
  }: {
    milestone: Milestone | LocalMilestone;
    property?: string;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const formatDate = (date: Date) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}`;
    };

    // Calculate the valid date range for this milestone
    const getValidDateRange = () => {
      // Start with project bounds, but exclude start and end dates
      let minDate = new Date(projectStartDate);
      minDate.setDate(minDate.getDate() + 1); // Day after project start
      
      let maxDate = new Date(projectEndDate);
      maxDate.setDate(maxDate.getDate() - 1); // Day before project end

      // Get all other milestones, sorted by date
      const otherMilestones = projectMilestones
        .filter(m => m.id !== milestone.id)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

      // Simple approach: find where this milestone fits in the sequence
      // Allow it to be placed in any valid gap between existing milestones
      
      if (otherMilestones.length === 0) {
        // No other milestones, can use full project range
        return { minDate, maxDate };
      }
      
      // Find the appropriate slot for this milestone
      // If it's currently before all other milestones, allow it to be placed before the first one
      const firstOtherMilestone = otherMilestones[0];
      if (milestone.dueDate <= firstOtherMilestone.dueDate) {
        const dayBefore = new Date(firstOtherMilestone.dueDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        maxDate = dayBefore;
        return { minDate, maxDate };
      }
      
      // Find the gap where this milestone currently belongs or should be placed
      for (let i = 0; i < otherMilestones.length - 1; i++) {
        const currentOther = otherMilestones[i];
        const nextOther = otherMilestones[i + 1];
        
        if (milestone.dueDate > currentOther.dueDate && milestone.dueDate < nextOther.dueDate) {
          // This milestone fits between currentOther and nextOther
          const dayAfter = new Date(currentOther.dueDate);
          dayAfter.setDate(dayAfter.getDate() + 1);
          const dayBefore = new Date(nextOther.dueDate);
          dayBefore.setDate(dayBefore.getDate() - 1);
          
          return { minDate: dayAfter, maxDate: dayBefore };
        }
      }
      
      // If we get here, this milestone is after all other milestones
      const lastOtherMilestone = otherMilestones[otherMilestones.length - 1];
      const dayAfter = new Date(lastOtherMilestone.dueDate);
      dayAfter.setDate(dayAfter.getDate() + 1);
      minDate = dayAfter;
      
      return { minDate, maxDate };
    };

    const { minDate, maxDate } = getValidDateRange();

    // Check if current date is valid
    const isCurrentDateValid = milestone.dueDate >= minDate && milestone.dueDate <= maxDate;

    // Determine the appropriate month to display in the calendar
    const getCalendarDefaultMonth = () => {
      if (isCurrentDateValid) {
        return milestone.dueDate;
      }
      
      // If current date is before valid range, show the first valid month
      if (milestone.dueDate < minDate) {
        return minDate;
      }
      
      // If current date is after valid range, show the last valid month
      if (milestone.dueDate > maxDate) {
        return maxDate;
      }
      
      // Fallback to minDate
      return minDate;
    };

    return (
      <div className="min-w-[140px]">
        <Label className="text-xs text-muted-foreground mb-1 block">Due Date</Label>
        
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-10 text-sm justify-start text-left font-normal px-3 w-full"
            >
              <CalendarIcon className="mr-2 h-3 w-3" />
              {formatDate(milestone.dueDate)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 border-b bg-gray-50">
              <div className="text-sm font-medium text-gray-700 mb-1">
                Milestone Date Range
              </div>
              <div className="text-xs text-gray-600">
                Must be between {formatDate(minDate)} and {formatDate(maxDate)}
              </div>
              {projectMilestones.filter(m => m.id !== milestone.id).length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Other milestones: {projectMilestones
                    .filter(m => m.id !== milestone.id)
                    .map(m => formatDate(m.dueDate))
                    .join(', ')}
                </div>
              )}
            </div>
            <Calendar
              mode="single"
              selected={milestone.dueDate}
              defaultMonth={getCalendarDefaultMonth()}
              onSelect={(selectedDate) => {
                if (selectedDate) {
                  handleSaveMilestoneProperty(milestone.id!, property, selectedDate);
                  setIsOpen(false);
                }
              }}
              disabled={(date) => {
                // Disable dates outside the valid range
                return date < minDate || date > maxDate;
              }}
              modifiers={{
                // Add custom styling for different date types
                otherMilestone: (date) => projectMilestones
                  .filter(m => m.id !== milestone.id)
                  .some(m => {
                    const mDate = new Date(m.dueDate);
                    return mDate.toDateString() === date.toDateString();
                  })
              }}
              modifiersStyles={{
                otherMilestone: {
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: 'rgb(239, 68, 68)',
                  fontWeight: 'bold'
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  // Get milestones for this project - handle both new and existing projects
  const projectMilestones = useMemo(() => {
    if (isCreatingProject && localMilestonesState) {
      // For new projects, use the provided local state
      return localMilestonesState.milestones;
    } else if (projectId) {
      // For existing projects, combine database milestones with any local ones
      const existing = milestones.filter(m => m.projectId === projectId);
      const newMilestones = localMilestones.filter(m => 'isNew' in m && m.isNew);
      return [...existing, ...newMilestones] as (Milestone | LocalMilestone)[];
    } else {
      // Fallback: just local milestones
      return localMilestones;
    }
  }, [milestones, projectId, localMilestones, isCreatingProject, localMilestonesState]);

  // Calculate total time allocation in hours
  const totalTimeAllocation = useMemo(() => {
    return projectMilestones.reduce((total, milestone) => total + milestone.timeAllocation, 0);
  }, [projectMilestones]);

  // Calculate suggested budget based on milestones
  const suggestedBudgetFromMilestones = useMemo(() => {
    if (totalTimeAllocation > projectEstimatedHours) {
      return Math.ceil(totalTimeAllocation);
    }
    return projectEstimatedHours;
  }, [totalTimeAllocation, projectEstimatedHours]);

  const addNewMilestone = () => {
    // Calculate the appropriate default date for the new milestone
    const getDefaultMilestoneDate = () => {
      // Start with the day after project start
      let defaultDate = new Date(projectStartDate);
      defaultDate.setDate(defaultDate.getDate() + 1);
      
      // If there are existing milestones, place this one after the last one
      if (projectMilestones.length > 0) {
        const sortedMilestones = [...projectMilestones].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
        const lastMilestone = sortedMilestones[sortedMilestones.length - 1];
        const dayAfterLast = new Date(lastMilestone.dueDate);
        dayAfterLast.setDate(dayAfterLast.getDate() + 1);
        
        // Use the later of: day after project start, or day after last milestone
        if (dayAfterLast > defaultDate) {
          defaultDate = dayAfterLast;
        }
      }
      
      // Ensure it's not beyond project end date
      const projectEnd = new Date(projectEndDate);
      projectEnd.setDate(projectEnd.getDate() - 1); // Day before project end
      if (defaultDate > projectEnd) {
        defaultDate = projectEnd;
      }
      
      return defaultDate;
    };

    const newMilestone: LocalMilestone = {
      id: `temp-${Date.now()}`, // Generate temporary ID for editing
      name: 'New Milestone',
      dueDate: getDefaultMilestoneDate(),
      timeAllocation: 8, // Default to 8 hours (1 day)
      projectId: projectId || 'temp', // Use temp for new projects
      order: projectMilestones.length,
      isNew: true
    };
    
    if (isCreatingProject && localMilestonesState) {
      // For new projects, update the provided state
      localMilestonesState.setMilestones([...localMilestonesState.milestones, newMilestone]);
    } else {
      // For existing projects, use local state
      setLocalMilestones(prev => [...prev, newMilestone]);
    }
  };

  const updateLocalMilestone = (index: number, updates: Partial<LocalMilestone>) => {
    if (isCreatingProject && localMilestonesState) {
      // For new projects, update the provided state
      const updatedMilestones = localMilestonesState.milestones.map((milestone, i) => 
        i === index ? { ...milestone, ...updates } : milestone
      );
      localMilestonesState.setMilestones(updatedMilestones);
    } else {
      // For existing projects, use local state
      setLocalMilestones(prev => prev.map((milestone, i) => 
        i === index ? { ...milestone, ...updates } : milestone
      ));
    }
  };

  const saveNewMilestone = async (index: number) => {
    const milestone = isCreatingProject && localMilestonesState 
      ? localMilestonesState.milestones[index]
      : localMilestones[index];
    
    if (!milestone || !milestone.name.trim()) return;

    // Check if total allocation exceeds project budget
    const newTotal = totalTimeAllocation;
    if (newTotal > projectEstimatedHours) {
      await showErrorToast(`Cannot save milestone: Total milestone allocation (${Math.ceil(newTotal)}h) would exceed project budget (${projectEstimatedHours}h).`);
      return;
    }

    // For new projects, we don't save to database yet - just keep in local state
    if (isCreatingProject) {
      // Mark the milestone as no longer "new" since it's been validated
      const updatedMilestone = { ...milestone, isNew: false };
      updateLocalMilestone(index, updatedMilestone);
      return;
    }

    // For existing projects, save to database
    if (projectId) {
      try {
        await addMilestone({
          name: milestone.name,
          dueDate: milestone.dueDate,
          timeAllocation: milestone.timeAllocation,
          projectId,
          order: milestone.order
        });
        
        // Remove from local state
        setLocalMilestones(prev => prev.filter((_, i) => i !== index));
      } catch (error) {
        console.error('Failed to save milestone:', error);
        await showErrorToast('Failed to save milestone. Please try again.');
      }
    }
  };

  const deleteLocalMilestone = (index: number) => {
    if (isCreatingProject && localMilestonesState) {
      // For new projects, update the provided state
      const updatedMilestones = localMilestonesState.milestones.filter((_, i) => i !== index);
      localMilestonesState.setMilestones(updatedMilestones);
    } else {
      // For existing projects, use local state
      setLocalMilestones(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    try {
      await deleteMilestone(milestoneId);
    } catch (error) {
      console.error('Failed to delete milestone:', error);
      await showErrorToast('Failed to delete milestone. Please try again.');
    }
  };

  const handleUpdateMilestone = async (milestoneId: string, updates: Partial<Milestone>) => {
    // Check if this update would exceed budget
    if (updates.timeAllocation !== undefined && wouldExceedBudget(milestoneId, updates.timeAllocation)) {
      await showErrorToast(`Cannot update milestone: Total milestone allocation would exceed project budget (${projectEstimatedHours}h).`);
      return;
    }

    try {
      await updateMilestone(milestoneId, updates);
    } catch (error) {
      console.error('Failed to update milestone:', error);
      await showErrorToast('Failed to update milestone. Please try again.');
    }
  };

  const isOverBudget = totalTimeAllocation > projectEstimatedHours;

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-8 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <h3 className="text-lg font-medium text-gray-900">Milestones</h3>
          {projectMilestones.length > 0 && (
            <span className="text-sm text-gray-500">
              ({projectMilestones.length})
            </span>
          )}
        </div>
        
        {isOverBudget && (
          <div className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {totalTimeAllocation}h / {projectEstimatedHours}h allocated
            </span>
          </div>
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-8 pb-6">
              {isOverBudget && (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Milestone allocations exceed project budget ({totalTimeAllocation}h / {projectEstimatedHours}h)
                    </span>
                  </div>
                  <p className="text-sm text-orange-700 mt-1">
                    Consider updating the project budget to {suggestedBudgetFromMilestones}h or adjusting milestone allocations.
                  </p>
                </div>
              )}

              {/* All Milestones with Inline Editing */}
              {projectMilestones.map((milestone, index) => (
                <div key={milestone.id || `milestone-${index}`} className="border border-gray-200 rounded-lg p-4 mb-3">
                  <div className="flex items-end justify-between">
                    {/* Left side: Name and Budget */}
                    <div className="flex items-end gap-3">
                      <MilestoneNameField milestone={milestone} />
                      <MilestoneBudgetField milestone={milestone} />
                    </div>
                    
                    {/* Right side: Due Date and Delete Button */}
                    <div className="flex items-end gap-3">
                      <MilestoneDateField milestone={milestone} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 w-10 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{milestone.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => {
                                if (milestone.id) {
                                  if (isCreatingProject && localMilestonesState) {
                                    // Remove from local state for new projects
                                    const filtered = localMilestonesState.milestones.filter(m => m.id !== milestone.id);
                                    localMilestonesState.setMilestones(filtered);
                                  } else {
                                    // Delete from database for existing projects
                                    handleDeleteMilestone(milestone.id);
                                  }
                                }
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Milestone
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Milestone Button */}
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={addNewMilestone}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Milestone
                </Button>
              </div>

              {/* Progress Summary */}
              {projectMilestones.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium">Total Allocation:</span>
                    <span className={`font-medium ${isOverBudget ? 'text-orange-600' : 'text-gray-900'}`}>
                      {totalTimeAllocation}h / {projectEstimatedHours}h
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
