import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle, Calendar as CalendarIcon, RotateCcw, RefreshCw, X, Flag } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Calendar } from '../../ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../ui/alert-dialog';
import { useProjectContext } from '../../../contexts/ProjectContext';
import { Milestone } from '@/types/core';
import { Project } from '@/types/core';
import { useToast } from '@/hooks/use-toast';
import { 
  calculateRecurringMilestoneCount, 
  calculateRecurringTotalAllocation, 
  detectRecurringPattern, 
  // NEW: Unified service imports (replacing legacy MilestoneManagementService)
  UnifiedMilestoneService,
  UnifiedMilestoneEntity,
  UnifiedProjectEntity,
  // MilestoneOrchestrator, // Deprecated - using ProjectMilestoneOrchestrator instead
  ProjectOrchestrator,
  ProjectMilestoneOrchestrator
} from '@/services';
import { supabase } from '@/integrations/supabase/client';

// Helper functions for day and date patterns
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
  const weeks = ['', '1st', '2nd', '3rd', '4th', '2nd last', 'last'];
  return weeks[week] || 'last';
};

// Compatibility function for calculateMilestoneInterval with the expected signature
const calculateMilestoneInterval = (
  firstDate: Date, 
  secondDate: Date
): { type: 'daily' | 'weekly' | 'monthly' | 'custom'; interval: number } => {
  const daysDifference = Math.round((secondDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDifference === 1) {
    return { type: 'daily', interval: 1 };
  } else if (daysDifference === 7) {
    return { type: 'weekly', interval: 1 };
  } else if (daysDifference >= 28 && daysDifference <= 31) {
    return { type: 'monthly', interval: 1 };
  } else if (daysDifference % 7 === 0) {
    return { type: 'weekly', interval: daysDifference / 7 };
  } else {
    return { type: 'custom', interval: daysDifference };
  }
};

interface ProjectMilestoneSectionProps {
  projectId?: string; // Made optional to support new projects
  projectEstimatedHours: number;
  projectStartDate: Date;
  projectEndDate: Date;
  projectContinuous?: boolean; // Whether the project is continuous
  onUpdateProjectBudget?: (newBudget: number) => void;
  onRecurringMilestoneChange?: (info: { 
    totalAllocation: number; 
    hasRecurring: boolean;
    ensureMilestonesAvailable?: (targetDate?: Date) => Promise<void>;
  }) => void;
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

interface RecurringMilestone {
  id: string;
  name: string;
  timeAllocation: number;
  recurringType: 'daily' | 'weekly' | 'monthly';
  recurringInterval: number;
  projectId: string;
  isRecurring: true;
  weeklyDayOfWeek?: number; // 0-6 (Sunday-Saturday) for weekly recurrence
  monthlyPattern?: 'date' | 'dayOfWeek'; // Pattern type for monthly recurrence
  monthlyDate?: number; // 1-31 for specific date of month
  monthlyWeekOfMonth?: number; // 1-6 (1st, 2nd, 3rd, 4th, 2nd last=5, last=6)
  monthlyDayOfWeek?: number; // 0-6 for day of week in monthly pattern
}

interface RecurringMilestoneConfig {
  name: string;
  timeAllocation: number;
  recurringType: 'daily' | 'weekly' | 'monthly';
  recurringInterval: number; // Every X days/weeks/months
  weeklyDayOfWeek?: number; // 0-6 (Sunday-Saturday) for weekly recurrence
  monthlyPattern?: 'date' | 'dayOfWeek'; // Pattern type for monthly recurrence
  monthlyDate?: number; // 1-31 for specific date of month
  monthlyWeekOfMonth?: number; // 1-6 (1st, 2nd, 3rd, 4th, 2nd last=5, last=6)
  monthlyDayOfWeek?: number; // 0-6 for day of week in monthly pattern
}

export function ProjectMilestoneSection({ 
  projectId, 
  projectEstimatedHours, 
  projectStartDate,
  projectEndDate,
  projectContinuous = false,
  onUpdateProjectBudget,
  onRecurringMilestoneChange,
  localMilestonesState,
  isCreatingProject = false
}: ProjectMilestoneSectionProps) {
  const { milestones: contextMilestones, addMilestone, updateMilestone, deleteMilestone, showMilestoneSuccessToast, normalizeMilestoneOrders, refetchMilestones } = useProjectContext();
  const milestones = Array.isArray(contextMilestones) ? contextMilestones : [];
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [localMilestones, setLocalMilestones] = useState<LocalMilestone[]>([]);
  const [editingProperty, setEditingProperty] = useState<string | null>(null);
  
  // Recurring milestone state
  const [recurringMilestone, setRecurringMilestone] = useState<RecurringMilestone | null>(null);
  const [showRecurringConfig, setShowRecurringConfig] = useState(false);
  const [showRegularMilestoneWarning, setShowRegularMilestoneWarning] = useState(false);
  const [showRecurringWarning, setShowRecurringWarning] = useState(false);
  const [isDeletingRecurringMilestone, setIsDeletingRecurringMilestone] = useState(false);
  const [frozenMilestoneCount, setFrozenMilestoneCount] = useState<number | null>(null);
  const [recurringConfig, setRecurringConfig] = useState<RecurringMilestoneConfig>({
    name: 'Milestone',
    timeAllocation: 8,
    recurringType: 'weekly',
    recurringInterval: 1,
    weeklyDayOfWeek: projectStartDate ? projectStartDate.getDay() : 1, // Default to project start day, or Monday
    monthlyPattern: 'date',
    monthlyDate: projectStartDate ? projectStartDate.getDate() : 1,
    monthlyWeekOfMonth: 1,
    monthlyDayOfWeek: projectStartDate ? projectStartDate.getDay() : 1
  });
  
  const [editingRecurringPattern, setEditingRecurringPattern] = useState(false);
  const [editingRecurringType, setEditingRecurringType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [editingRecurringInterval, setEditingRecurringInterval] = useState(1);
  const [editingRecurringLoad, setEditingRecurringLoad] = useState(false);
  const [editingLoadValue, setEditingLoadValue] = useState(0);

  // Additional editing state for the new pattern options
  const [editingWeeklyDayOfWeek, setEditingWeeklyDayOfWeek] = useState<number>(1);
  const [editingMonthlyPattern, setEditingMonthlyPattern] = useState<'date' | 'dayOfWeek'>('date');
  const [editingMonthlyDate, setEditingMonthlyDate] = useState<number>(1);
  const [editingMonthlyWeekOfMonth, setEditingMonthlyWeekOfMonth] = useState<number>(1);
  const [editingMonthlyDayOfWeek, setEditingMonthlyDayOfWeek] = useState<number>(1);

  // Handle updating recurring milestone load
  const handleUpdateRecurringLoad = async (direction: 'forward' | 'both') => {
    if (!recurringMilestone || !projectId) return;

    // Delegate to ProjectMilestoneOrchestrator (AI Rule: use existing orchestrator)
    const result = await ProjectMilestoneOrchestrator.updateRecurringMilestoneLoad(
      projectId,
      editingLoadValue,
      {
        projectMilestones: projectMilestones.filter(m => m.id) as Milestone[],
        recurringMilestone,
        updateMilestone: async (id: string, updates: any, options?: any) => {
          await updateMilestone(id, updates, options);
        },
        setRecurringMilestone
      }
    );

    if (!result.success) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
      return;
    }
    
    setEditingRecurringLoad(false);
  };

  // Helper function to check if milestone allocation would exceed budget using domain entity
  const wouldExceedBudget = (milestoneId: string, newTimeAllocation: number) => {
    const validMilestones = projectMilestones.filter(m => m.id) as Milestone[];
    const validation = UnifiedMilestoneEntity.wouldUpdateExceedBudget(
      validMilestones,
      milestoneId,
      newTimeAllocation,
      projectEstimatedHours
    );
    return !validation.isValid;
  };

  // Helper function to handle property saving for milestones
  const handleSaveMilestoneProperty = async (milestoneId: string, property: string, value: any) => {
    // Delegate to ProjectMilestoneOrchestrator (AI Rule: use existing orchestrator)
    const validMilestones = projectMilestones.filter(m => m.id) as Milestone[];
    const result = await ProjectMilestoneOrchestrator.updateMilestoneProperty(
      milestoneId,
      property,
      value,
      {
        projectMilestones: validMilestones,
        projectEstimatedHours,
        localMilestones,
        isCreatingProject,
        localMilestonesState,
        addMilestone: async (milestone: any) => {
          await addMilestone(milestone);
          return milestone; // Return the milestone as expected
        },
        updateMilestone: async (id: string, updates: any, options?: any) => {
          await updateMilestone(id, updates, options);
        },
        setLocalMilestones
      }
    );

    if (!result.success) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
      setEditingProperty(null);
      return;
    }

    setEditingProperty(null);
  };

  // Inline editing components similar to ProjectModal
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
          {!projectContinuous && (
            <span className="text-xs text-muted-foreground/60">of {projectEstimatedHours}h</span>
          )}
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

    // Calculate the valid date range for this milestone using unified service
    const getValidDateRange = () => {
      const result = UnifiedMilestoneService.calculateMilestoneDateRange({
        projectStartDate,
        projectEndDate,
        existingMilestones: projectMilestones,
        currentMilestone: milestone
      });
      
      return {
        minDate: result.minDate,
        maxDate: result.maxDate
      };
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
      return localMilestonesState.milestones || [];
    } else if (projectId) {
      // For existing projects, combine database milestones with any local ones
      const existing = Array.isArray(milestones) ? milestones.filter(m => m.projectId === projectId) : [];
      const newMilestones = localMilestones.filter(m => 'isNew' in m && m.isNew);
      return [...existing, ...newMilestones] as (Milestone | LocalMilestone)[];
    } else {
      // Fallback: just local milestones
      return localMilestones || [];
    }
  }, [milestones, projectId, localMilestones, isCreatingProject, localMilestonesState]);

  // Check if project has recurring milestones and reconstruct config
  React.useEffect(() => {
    if (recurringMilestone || !projectId || isDeletingRecurringMilestone) return;
    
    // Look for recurring milestone pattern in existing milestones (but don't show them as individual cards)
    const recurringPattern = projectMilestones.filter(m => 
      m.name && /\s\d+$/.test(m.name) // Ends with space and number
    );
    
    if (recurringPattern.length >= 1) {
      // Detect recurring pattern from existing milestones
      const sortedMilestones = recurringPattern.sort((a, b) => 
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
      
      let recurringType: 'daily' | 'weekly' | 'monthly' = 'weekly';
      let interval = 1;
      
      if (recurringPattern.length > 1) {
        // Calculate interval between milestones using service
        const firstDate = new Date(sortedMilestones[0].dueDate);
        const secondDate = new Date(sortedMilestones[1].dueDate);
        const intervalResult = calculateMilestoneInterval(firstDate, secondDate);
        
        recurringType = intervalResult.type === 'custom' ? 'daily' : intervalResult.type;
        interval = intervalResult.interval;
      }
      
      // Extract base name (remove the number at the end)
      const baseName = sortedMilestones[0].name.replace(/\s\d+$/, '') || 'Recurring Milestone';
      
      // Reconstruct the recurring milestone config (this will hide individual milestone cards)
      setRecurringMilestone({
        id: 'recurring-milestone',
        name: baseName,
        timeAllocation: sortedMilestones[0].timeAllocation,
        recurringType,
        recurringInterval: interval,
        projectId,
        isRecurring: true
      });
    }
  }, [projectMilestones, recurringMilestone, projectId, isDeletingRecurringMilestone]);

  // Calculate total time allocation including recurring milestone
  const totalRecurringAllocation = useMemo(() => {
    if (recurringMilestone) {
      return calculateRecurringTotalAllocation({
        config: {
          recurringType: recurringMilestone.recurringType,
          recurringInterval: recurringMilestone.recurringInterval,
          timeAllocation: recurringMilestone.timeAllocation
        },
        projectStartDate,
        projectEndDate,
        projectContinuous
      });
    }
    return 0;
  }, [recurringMilestone, projectStartDate, projectEndDate, projectContinuous]);

  // Calculate budget analysis inline (MilestoneOrchestrator is deprecated)
  const budgetAnalysis = useMemo(() => {
    const totalAllocated = projectMilestones.reduce((sum, m) => sum + m.timeAllocation, 0) + totalRecurringAllocation;
    const remainingBudget = projectEstimatedHours - totalAllocated;
    const isOverBudget = totalAllocated > projectEstimatedHours;
    
    return {
      totalAllocated,
      remainingBudget,
      isOverBudget,
      utilizationPercent: projectEstimatedHours > 0 ? (totalAllocated / projectEstimatedHours) * 100 : 0
    };
  }, [projectMilestones, projectEstimatedHours, totalRecurringAllocation]);

  // NEW: Enhanced project analysis using domain entities
  const projectHealthAnalysis = useMemo(() => {
    const validMilestones = projectMilestones.filter(m => m.id) as Milestone[];
    const project = {
      id: projectId || 'new',
      name: 'Current Project',
      client: '',
      startDate: projectStartDate,
      endDate: projectEndDate,
      estimatedHours: projectEstimatedHours,
      continuous: projectContinuous,
      color: '',
      groupId: '',
      rowId: '',
      userId: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return ProjectOrchestrator.analyzeProjectMilestones(project, validMilestones);
  }, [projectMilestones, projectEstimatedHours, projectStartDate, projectEndDate, projectContinuous, projectId]);

  // Calculate total time allocation in hours (for backward compatibility)
  const totalTimeAllocation = budgetAnalysis.totalAllocated;

  // Calculate suggested budget based on milestones (for backward compatibility)
  const suggestedBudgetFromMilestones = Math.max(projectEstimatedHours, budgetAnalysis.totalAllocated);

  const addNewMilestone = () => {
    // Calculate the appropriate default date for the new milestone using unified service
    const getDefaultMilestoneDate = () => {
      return UnifiedMilestoneService.calculateDefaultMilestoneDate({
        projectStartDate,
        projectEndDate,
        existingMilestones: projectMilestones
      });
    };

    const newMilestone: LocalMilestone = {
      id: `temp-${Date.now()}`, // Generate temporary ID for editing
      name: 'New Milestone',
      dueDate: getDefaultMilestoneDate(),
      timeAllocation: 8, // Default to 8 hours (1 day)
      projectId: projectId || 'temp', // Use temp for new projects
      order: projectMilestones.length,
      userId: '', // Will be set by backend
      createdAt: new Date(),
      updatedAt: new Date(),
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

    // For new projects, handle locally without database operations
    if (isCreatingProject) {
      const updatedMilestone = { ...milestone, isNew: false };
      updateLocalMilestone(index, updatedMilestone);
      return;
    }

    // For existing projects, delegate to orchestrator (AI Rule: use existing orchestrator)
    if (projectId) {
      const result = await ProjectMilestoneOrchestrator.saveNewMilestone(
        index,
        {
          localMilestones,
          projectMilestones: projectMilestones.filter(m => m.id && m.id !== milestone.id) as Milestone[],
          projectEstimatedHours,
          projectId,
          addMilestone: async (milestoneData: any) => {
            await addMilestone(milestoneData);
            return milestoneData;
          },
          setLocalMilestones
        }
      );

      if (!result.success) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return;
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
      await deleteMilestone(milestoneId, { silent: true });
      // No toast - will be handled by modal confirmation
    } catch (error) {
      console.error('Failed to delete milestone:', error);
      // Only show error toasts
      toast({
        title: "Error",
        description: "Failed to delete milestone. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateMilestone = async (milestoneId: string, updates: Partial<Milestone>) => {
    // Check if this update would exceed budget
    if (updates.timeAllocation !== undefined && wouldExceedBudget(milestoneId, updates.timeAllocation)) {
      toast({
        title: "Error",
        description: `Cannot update milestone: Total milestone allocation would exceed project budget (${projectEstimatedHours}h).`,
        variant: "destructive",
      });
      return;
    }

    try {
      await updateMilestone(milestoneId, updates, { silent: true });
      // No success toast - will be handled by modal confirmation
    } catch (error) {
      console.error('Failed to update milestone:', error);
      toast({
        title: "Error",
        description: "Failed to update milestone. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isOverBudget = budgetAnalysis.isOverBudget;

  // Generate recurring milestones based on configuration using enhanced logic
  const generateRecurringMilestones = (config: RecurringMilestoneConfig, maxCount?: number) => {
    const milestones: any[] = [];
    let currentDate = new Date(projectStartDate);
    currentDate.setDate(currentDate.getDate() + 1); // Start day after project start
    let order = 0;

    const endDate = projectContinuous ? 
      new Date(currentDate.getTime() + 365 * 24 * 60 * 60 * 1000) : // 1 year for continuous
      new Date(projectEndDate);
    endDate.setDate(endDate.getDate() - 1); // End day before project end

    // Default limit for better performance: smaller for lazy loading, larger for non-continuous projects
    const defaultLimit = projectContinuous ? 10 : 100;
    const limit = maxCount || defaultLimit;

    while (currentDate <= endDate && order < limit) { // Configurable limit
      milestones.push({
        id: `recurring-${order}`,
        name: `${config.name} ${order + 1}`,
        dueDate: new Date(currentDate),
        timeAllocation: config.timeAllocation,
        projectId: projectId || 'temp',
        order,
        isRecurring: true,
        isNew: true
      });

      // Calculate next occurrence based on pattern
      switch (config.recurringType) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + config.recurringInterval);
          break;
        case 'weekly':
          // Move to the next occurrence of the specified day of week
          const targetDayOfWeek = config.weeklyDayOfWeek ?? currentDate.getDay();
          const daysUntilTarget = (targetDayOfWeek - currentDate.getDay() + 7) % 7 || 7;
          currentDate.setDate(currentDate.getDate() + daysUntilTarget);
          
          // If this is not the first milestone, add the interval
          if (order > 0) {
            currentDate.setDate(currentDate.getDate() + (7 * (config.recurringInterval - 1)));
          }
          break;
        case 'monthly':
          if (config.monthlyPattern === 'date') {
            // Specific date pattern (e.g., 15th of each month)
            const targetDate = config.monthlyDate ?? 1;
            currentDate.setMonth(currentDate.getMonth() + config.recurringInterval);
            currentDate.setDate(Math.min(targetDate, new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()));
          } else {
            // Day of week pattern (e.g., 3rd Tuesday, last Friday, 2nd last Monday)
            const targetWeekOfMonth = config.monthlyWeekOfMonth ?? 1;
            const targetDayOfWeek = config.monthlyDayOfWeek ?? 1;
            
            currentDate.setMonth(currentDate.getMonth() + config.recurringInterval);
            
            if (targetWeekOfMonth === 6) {
              // "Last" occurrence - find the last occurrence of the target day in the month
              const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
              const lastDayWeekday = lastDayOfMonth.getDay();
              const daysToSubtract = (lastDayWeekday - targetDayOfWeek + 7) % 7;
              currentDate.setDate(lastDayOfMonth.getDate() - daysToSubtract);
            } else if (targetWeekOfMonth === 5) {
              // "2nd last" occurrence - find the second last occurrence of the target day in the month
              const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
              const lastDayWeekday = lastDayOfMonth.getDay();
              const daysToSubtract = (lastDayWeekday - targetDayOfWeek + 7) % 7;
              const lastOccurrence = lastDayOfMonth.getDate() - daysToSubtract;
              const secondLastOccurrence = lastOccurrence - 7;
              
              // Use second last if it's valid (positive), otherwise use last
              currentDate.setDate(secondLastOccurrence > 0 ? secondLastOccurrence : lastOccurrence);
            } else {
              // Find the nth occurrence of the target day in the month (1st, 2nd, 3rd, 4th)
              const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
              const firstDayWeekday = firstDayOfMonth.getDay();
              const daysToAdd = (targetDayOfWeek - firstDayWeekday + 7) % 7;
              const firstOccurrence = 1 + daysToAdd;
              const targetDate = firstOccurrence + ((targetWeekOfMonth - 1) * 7);
              
              // Check if the calculated date exists in the month
              const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
              if (targetDate <= daysInMonth) {
                currentDate.setDate(targetDate);
              } else {
                // If the target week doesn't exist, use the last occurrence
                const lastOccurrence = targetDate - 7;
                currentDate.setDate(lastOccurrence > 0 ? lastOccurrence : firstOccurrence);
              }
            }
          }
          break;
      }
      
      order++;
    }

    return milestones;
  };

  // Handle creating recurring milestone
  const handleCreateRecurringMilestone = () => {
    if (projectMilestones.length > 0) {
      setShowRecurringWarning(true);
      return;
    }
    setShowRecurringConfig(true);
  };

  // Auto-generate recurring milestones as needed (transparent to user)
  const ensureRecurringMilestonesAvailable = React.useCallback(async (targetDate?: Date) => {
    if (!recurringMilestone || !projectId) return;
    
    // Get current milestone count
    const currentMilestones = projectMilestones.filter(m => 
      m.name && /\s\d+$/.test(m.name)
    );
    
    // Calculate total milestones needed for the project duration
    const projectDurationMs = projectContinuous ? 
      365 * 24 * 60 * 60 * 1000 : // 1 year for continuous
      new Date(projectEndDate).getTime() - new Date(projectStartDate).getTime();
    
    const projectDurationDays = Math.ceil(projectDurationMs / (24 * 60 * 60 * 1000));
    
    // Estimate total milestones needed based on recurrence pattern
    let estimatedTotalMilestones = 0;
    switch (recurringMilestone.recurringType) {
      case 'daily':
        estimatedTotalMilestones = Math.floor(projectDurationDays / recurringMilestone.recurringInterval);
        break;
      case 'weekly':
        estimatedTotalMilestones = Math.floor(projectDurationDays / (7 * recurringMilestone.recurringInterval));
        break;
      case 'monthly':
        estimatedTotalMilestones = Math.floor(projectDurationDays / (30 * recurringMilestone.recurringInterval));
        break;
    }
    
    // For continuous projects, ensure we have at least 6 months worth
    // For time-bounded projects, only generate what's actually needed
    const targetMilestoneCount = projectContinuous ? 
      Math.max(26, estimatedTotalMilestones) : // At least 6 months for continuous
      estimatedTotalMilestones; // Exact amount for time-bounded
    
    const needsMoreMilestones = currentMilestones.length < targetMilestoneCount;
    
    // Or if a specific target date is provided, ensure we have milestones up to that date
    let needsCoverageToDate = false;
    if (targetDate && currentMilestones.length > 0) {
      const lastMilestone = currentMilestones.sort((a, b) => 
        new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
      )[0];
      needsCoverageToDate = new Date(lastMilestone.dueDate) < targetDate;
    }
    
    if (!needsMoreMilestones && !needsCoverageToDate) return;
    
    // No generation feedback - everything should be instant and silent
    try {
      const recurringConfig: RecurringMilestoneConfig = {
        name: recurringMilestone.name,
        timeAllocation: recurringMilestone.timeAllocation,
        recurringType: recurringMilestone.recurringType,
        recurringInterval: recurringMilestone.recurringInterval,
        weeklyDayOfWeek: recurringMilestone.weeklyDayOfWeek,
        monthlyPattern: recurringMilestone.monthlyPattern,
        monthlyDate: recurringMilestone.monthlyDate,
        monthlyWeekOfMonth: recurringMilestone.monthlyWeekOfMonth,
        monthlyDayOfWeek: recurringMilestone.monthlyDayOfWeek
      };
      
      // Calculate how many milestones to generate
      const milestonesToGenerate = targetMilestoneCount - currentMilestones.length;
      const batchSize = Math.min(milestonesToGenerate, 20); // Don't generate more than 20 at once
      const startFromIndex = currentMilestones.length;
      const allMilestones = generateRecurringMilestones(recurringConfig, startFromIndex + batchSize);
      const newMilestones = allMilestones.slice(startFromIndex, startFromIndex + batchSize);
      
      // Save new milestones to database in background
      const savePromises = newMilestones.map(milestone =>
        addMilestone({
          name: milestone.name,
          due_date: milestone.dueDate.toISOString(),
          time_allocation: milestone.timeAllocation,
          project_id: projectId
        }, { silent: true })
      );
      
      await Promise.all(savePromises);
      
    } catch (error) {
      console.error('Error auto-generating recurring milestones:', error);
    }
  }, [recurringMilestone, projectId, projectMilestones, generateRecurringMilestones, addMilestone, projectContinuous, projectStartDate, projectEndDate]);

  // Auto-trigger milestone generation when needed
  React.useEffect(() => {
    if (recurringMilestone && projectContinuous) {
      ensureRecurringMilestonesAvailable();
    }
  }, [recurringMilestone, projectContinuous, ensureRecurringMilestonesAvailable]);

  // Load recurring milestone configuration from local storage on mount
  React.useEffect(() => {
    if (projectId && !recurringMilestone && !isDeletingRecurringMilestone) {
      const stored = localStorage.getItem(`recurring-milestone-${projectId}`);
      if (stored) {
        try {
          const storedData = JSON.parse(stored);
          setRecurringMilestone(storedData);
        } catch (error) {
          console.error('Error loading stored recurring milestone:', error);
          localStorage.removeItem(`recurring-milestone-${projectId}`);
        }
      }
    }
  }, [projectId, recurringMilestone, isDeletingRecurringMilestone]);

  // Handle confirming recurring milestone creation
  const handleConfirmRecurringMilestone = async () => {
    if (!projectId) return;
    
    try {
      // Create project object for orchestrator (with minimal required fields)
      const project: Project = {
        id: projectId,
        startDate: projectStartDate,
        endDate: projectEndDate,
        continuous: projectContinuous,
        name: 'Project', // Placeholder since we only need the project for date calculations
        client: 'Client', // Placeholder
        estimatedHours: projectEstimatedHours || 0,
        color: '#000000', // Placeholder
        groupId: 'group', // Placeholder
        rowId: 'row', // Placeholder
        userId: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Convert component config to orchestrator config
      const orchestratorConfig = {
        name: recurringConfig.name,
        timeAllocation: recurringConfig.timeAllocation,
        recurringType: recurringConfig.recurringType,
        recurringInterval: recurringConfig.recurringInterval,
        weeklyDayOfWeek: recurringConfig.weeklyDayOfWeek,
        monthlyPattern: recurringConfig.monthlyPattern,
        monthlyDate: recurringConfig.monthlyDate,
        monthlyWeekOfMonth: recurringConfig.monthlyWeekOfMonth,
        monthlyDayOfWeek: recurringConfig.monthlyDayOfWeek
      };

      // Use ProjectMilestoneOrchestrator for complex workflow
      const result = await ProjectMilestoneOrchestrator.createRecurringMilestones(
        projectId,
        project,
        orchestratorConfig,
        {
          normalizeMilestoneOrders,
          refetchMilestones
        }
      );

      if (result.success && result.recurringMilestone) {
        // Update UI state with successful result
        setRecurringMilestone(result.recurringMilestone);
        
        // Show success message
        toast({
          title: "Recurring milestones created",
          description: `Generated ${result.generatedCount} of estimated ${result.estimatedTotalCount} milestones`,
        });

        // Trigger auto-generation for continuous projects
        if (projectContinuous) {
          await ensureRecurringMilestonesAvailable();
        }
        
        // Update UI state on success
        setShowRecurringConfig(false);
        setShowRecurringWarning(false);
      } else {
        throw new Error(result.error || 'Failed to create recurring milestones');
      }
    } catch (error) {
      console.error('Error creating recurring milestones:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create recurring milestones",
        variant: "destructive",
      });
    }
  };

  // Handle deleting recurring milestones
  const handleDeleteRecurringMilestones = async () => {
    // Set deletion flag to prevent restoration
    setIsDeletingRecurringMilestone(true);
    
    // Clear local storage FIRST to prevent restoration
    if (projectId) {
      localStorage.removeItem(`recurring-milestone-${projectId}`);
    }
    
    // Instantly clear the UI state for better UX
    setRecurringMilestone(null);
    setLocalMilestones([]);
    
    // Asynchronously clean up database in background
    setTimeout(async () => {
      try {
        if (isCreatingProject && localMilestonesState) {
          localMilestonesState.setMilestones([]);
        } else {
          // For existing projects, delete recurring milestone pattern
          const recurringMilestones = projectMilestones.filter(m => 
            m.name && /\s\d+$/.test(m.name) // Ends with space and number
          );
          
          // Delete each recurring milestone from database silently in background
          const deletePromises = recurringMilestones
            .filter(milestone => milestone.id && !milestone.id.startsWith('temp-'))
            .map(milestone => 
              deleteMilestone(milestone.id!, { silent: true }).catch(error => 
                console.error('Error deleting milestone:', error)
              )
            );
          
          // Wait for all deletions to complete
          await Promise.all(deletePromises);
        }
      } catch (error) {
        console.error('Error deleting some milestones:', error);
      } finally {
        // Clear deletion flag after cleanup is complete
        setIsDeletingRecurringMilestone(false);
      }
    }, 100);
  };

  // Handle adding regular milestone when recurring exists
  const handleAddMilestoneWithWarning = () => {
    if (recurringMilestone || projectMilestones.some(m => m.id?.startsWith('recurring-'))) {
      setShowRegularMilestoneWarning(true);
      return;
    }
    addNewMilestone();
  };

  // Expose milestone generation function for external components (timeline, calendar, etc.)
  React.useEffect(() => {
    if (onRecurringMilestoneChange) {
      onRecurringMilestoneChange({
        totalAllocation: totalRecurringAllocation,
        hasRecurring: !!recurringMilestone,
        ensureMilestonesAvailable: ensureRecurringMilestonesAvailable // Expose the function
      });
    }
  }, [totalRecurringAllocation, recurringMilestone, onRecurringMilestoneChange, ensureRecurringMilestonesAvailable]);

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
        </div>
        
        {isOverBudget && !projectContinuous && (
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
              {isOverBudget && !projectContinuous && (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-orange-800">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Milestone allocations exceed project budget ({totalTimeAllocation}h / {projectEstimatedHours}h)
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-300 text-orange-700 hover:bg-orange-100"
                      onClick={() => {
                        if (onUpdateProjectBudget) {
                          onUpdateProjectBudget(totalTimeAllocation);
                        }
                      }}
                    >
                      Update to {totalTimeAllocation}h
                    </Button>
                  </div>
                  <p className="text-sm text-orange-700 mt-1">
                    Consider updating the project budget or adjusting milestone allocations.
                  </p>
                </div>
              )}

              {/* All Milestones with Inline Editing */}
              {projectMilestones.filter(milestone => {
                // If we have a recurring milestone config, filter out the individual recurring milestones
                if ((recurringMilestone || isDeletingRecurringMilestone) && milestone.name && /\s\d+$/.test(milestone.name)) {
                  return false; // Don't show individual recurring milestones as cards
                }
                return true; // Show regular milestones
              }).map((milestone, index) => (
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

              {/* Recurring Milestone Card */}
              {recurringMilestone && (
                <div className="border border-gray-200 rounded-lg p-4 mb-3">
                  <div className="flex items-end justify-between">
                    {/* Left side: Name and Budget */}
                    <div className="flex items-end gap-3">
                      <div className="min-w-[120px]">
                        <Label className="text-xs text-muted-foreground mb-1 block">Name</Label>
                        <div className="h-9 flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium">{recurringMilestone.name}</span>
                        </div>
                      </div>
                      <div className="min-w-[80px]">
                        <Label className="text-xs text-muted-foreground mb-1 block">Time Budget</Label>
                        <div className="flex items-center gap-1">
                          {editingRecurringLoad ? (
                            <Input
                              type="number"
                              value={editingLoadValue}
                              onChange={(e) => setEditingLoadValue(Number(e.target.value))}
                              className="h-9 text-sm border-border bg-background w-20"
                              min="0"
                              step="0.5"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateRecurringLoad('both');
                                } else if (e.key === 'Escape') {
                                  setEditingRecurringLoad(false);
                                }
                              }}
                              onBlur={() => {
                                if (editingLoadValue !== recurringMilestone.timeAllocation) {
                                  handleUpdateRecurringLoad('both');
                                } else {
                                  setEditingRecurringLoad(false);
                                }
                              }}
                              autoFocus
                            />
                          ) : (
                            <Button
                              variant="outline"
                              className="h-9 text-sm justify-start text-left font-normal px-3"
                              style={{ width: `${Math.max(`${recurringMilestone.timeAllocation}h`.length * 8 + 40, 80)}px` }}
                              onClick={() => {
                                setEditingRecurringLoad(true);
                                setEditingLoadValue(recurringMilestone.timeAllocation);
                              }}
                            >
                              {recurringMilestone.timeAllocation}h
                            </Button>
                          )}
                          {!projectContinuous && (
                            <span className="text-xs text-muted-foreground/60">of {projectEstimatedHours}h</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Right side: Pattern and Delete Button */}
                    <div className="flex items-end gap-3">
                      <div className="min-w-[180px]">
                        <Label className="text-xs text-muted-foreground mb-1 block">Pattern</Label>
                        {editingRecurringPattern ? (
                          <div className="space-y-2">
                            <Select 
                              value={editingRecurringType} 
                              onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setEditingRecurringType(value)}
                            >
                              <SelectTrigger className="w-full h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            {/* Weekly day selection for editing */}
                            {editingRecurringType === 'weekly' && (
                              <Select 
                                value={editingWeeklyDayOfWeek.toString()} 
                                onValueChange={(value) => setEditingWeeklyDayOfWeek(parseInt(value))}
                              >
                                <SelectTrigger className="w-full h-9">
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
                            )}

                            {/* Monthly pattern selection for editing */}
                            {editingRecurringType === 'monthly' && (
                              <div className="space-y-2">
                                <Select 
                                  value={editingMonthlyPattern} 
                                  onValueChange={(value: 'date' | 'dayOfWeek') => setEditingMonthlyPattern(value)}
                                >
                                  <SelectTrigger className="w-full h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="date">Specific date</SelectItem>
                                    <SelectItem value="dayOfWeek">Day of week pattern</SelectItem>
                                  </SelectContent>
                                </Select>

                                {editingMonthlyPattern === 'date' ? (
                                  <Select 
                                    value={editingMonthlyDate.toString()} 
                                    onValueChange={(value) => setEditingMonthlyDate(parseInt(value))}
                                  >
                                    <SelectTrigger className="w-full h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Array.from({ length: 31 }, (_, i) => i + 1).map(date => (
                                        <SelectItem key={date} value={date.toString()}>
                                          {getOrdinalNumber(date)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="space-y-1">
                                    <Select 
                                      value={editingMonthlyWeekOfMonth.toString()} 
                                      onValueChange={(value) => setEditingMonthlyWeekOfMonth(parseInt(value))}
                                    >
                                      <SelectTrigger className="w-full h-9">
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
                                    <Select 
                                      value={editingMonthlyDayOfWeek.toString()} 
                                      onValueChange={(value) => setEditingMonthlyDayOfWeek(parseInt(value))}
                                    >
                                      <SelectTrigger className="w-full h-9">
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
                                )}
                              </div>
                            )}
                            
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                onClick={async () => {
                                  // Update recurring pattern
                                  if (recurringMilestone) {
                                    const updatedMilestone = {
                                      ...recurringMilestone,
                                      recurringType: editingRecurringType,
                                      recurringInterval: editingRecurringInterval,
                                      weeklyDayOfWeek: editingWeeklyDayOfWeek,
                                      monthlyPattern: editingMonthlyPattern,
                                      monthlyDate: editingMonthlyDate,
                                      monthlyWeekOfMonth: editingMonthlyWeekOfMonth,
                                      monthlyDayOfWeek: editingMonthlyDayOfWeek
                                    };
                                    setRecurringMilestone(updatedMilestone);
                                    
                                    // Delete existing recurring milestones and recreate with new pattern
                                    await handleDeleteRecurringMilestones();
                                    
                                    // Recreate with new pattern
                                    const newConfig = {
                                      name: recurringMilestone.name,
                                      timeAllocation: recurringMilestone.timeAllocation,
                                      recurringType: editingRecurringType,
                                      recurringInterval: editingRecurringInterval,
                                      weeklyDayOfWeek: editingWeeklyDayOfWeek,
                                      monthlyPattern: editingMonthlyPattern,
                                      monthlyDate: editingMonthlyDate,
                                      monthlyWeekOfMonth: editingMonthlyWeekOfMonth,
                                      monthlyDayOfWeek: editingMonthlyDayOfWeek
                                    };
                                    
                                    const generatedMilestones = generateRecurringMilestones(newConfig);
                                    
                                    for (const milestone of generatedMilestones) {
                                      await addMilestone({
                                        name: milestone.name,
                                        due_date: milestone.dueDate.toISOString(),
                                        time_allocation: milestone.timeAllocation,
                                        project_id: projectId!
                                      }, { silent: true });
                                    }
                                    
                                    setRecurringMilestone(updatedMilestone);
                                    // No toast - will be handled by modal confirmation
                                  }
                                  setEditingRecurringPattern(false);
                                }}
                              >
                                Save
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => setEditingRecurringPattern(false)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            className="h-9 text-sm justify-start text-left font-normal px-3 w-full"
                            onClick={() => {
                              setEditingRecurringPattern(true);
                              setEditingRecurringType(recurringMilestone.recurringType);
                              setEditingRecurringInterval(recurringMilestone.recurringInterval);
                              setEditingWeeklyDayOfWeek(recurringMilestone.weeklyDayOfWeek ?? projectStartDate.getDay());
                              setEditingMonthlyPattern(recurringMilestone.monthlyPattern ?? 'date');
                              setEditingMonthlyDate(recurringMilestone.monthlyDate ?? projectStartDate.getDate());
                              setEditingMonthlyWeekOfMonth(recurringMilestone.monthlyWeekOfMonth ?? 1);
                              setEditingMonthlyDayOfWeek(recurringMilestone.monthlyDayOfWeek ?? projectStartDate.getDay());
                            }}
                          >
                            {recurringMilestone.recurringType === 'weekly' 
                              ? `Every ${getDayName(recurringMilestone.weeklyDayOfWeek ?? projectStartDate.getDay())}`
                              : recurringMilestone.recurringType === 'monthly'
                              ? recurringMilestone.monthlyPattern === 'date'
                                ? `${getOrdinalNumber(recurringMilestone.monthlyDate ?? projectStartDate.getDate())} of each month`
                                : `${getWeekOfMonthName(recurringMilestone.monthlyWeekOfMonth ?? 1)} ${getDayName(recurringMilestone.monthlyDayOfWeek ?? projectStartDate.getDay())} of each month`
                              : 'Daily'
                            }
                          </Button>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Recurring Milestones</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete the recurring milestone pattern? This will remove the configuration and any generated milestones. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => {
                                handleDeleteRecurringMilestones();
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Recurring Milestones
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  
                  {editingRecurringLoad && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-700 mb-3">
                        Update recurring milestone allocation from {recurringMilestone.timeAllocation}h to {editingLoadValue}h:
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateRecurringLoad('forward')}
                          className="flex-1"
                        >
                          Going Forward Only
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateRecurringLoad('both')}
                          className="flex-1"
                        >
                          Going Forward & Back
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Transparent status for continuous projects */}
                  {projectContinuous && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">
                            Milestones are generated automatically as needed
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Status for time-bounded projects */}
                  {!projectContinuous && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">
                            Based on project timeline and recurrence pattern
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Add Milestone Button */}
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleAddMilestoneWithWarning}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Milestone
                </Button>

                <Button
                  variant="outline"
                  onClick={handleCreateRecurringMilestone}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Add Recurring Milestone
                </Button>
              </div>

              {/* Warning: Regular milestone when recurring exists */}
              <AlertDialog open={showRegularMilestoneWarning} onOpenChange={setShowRegularMilestoneWarning}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Recurring Milestones?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This project currently has recurring milestones. To add a regular milestone, you must first delete all recurring milestones. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => {
                        handleDeleteRecurringMilestones();
                        addNewMilestone();
                        setShowRegularMilestoneWarning(false);
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Recurring & Add Regular
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Warning: Recurring milestone when regular exists */}
              <AlertDialog open={showRecurringWarning} onOpenChange={setShowRecurringWarning}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Existing Milestones?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This project has existing milestones. Creating recurring milestones will delete all existing milestones. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => {
                        handleDeleteRecurringMilestones();
                        setShowRecurringConfig(true);
                        setShowRecurringWarning(false);
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete & Continue
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Recurring Milestone Configuration Dialog */}
              <AlertDialog open={showRecurringConfig} onOpenChange={setShowRecurringConfig}>
                <AlertDialogContent className="max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Configure Recurring Milestone</AlertDialogTitle>
                    <AlertDialogDescription>
                      Set up milestones that repeat at regular intervals throughout your project timeline.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="milestone-name">Milestone Name</Label>
                      <Input
                        id="milestone-name"
                        value={recurringConfig.name}
                        onChange={(e) => setRecurringConfig(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Weekly Review"
                      />
                    </div>

                    <div>
                      <Label htmlFor="time-allocation">Time Allocation (hours)</Label>
                      <Input
                        id="time-allocation"
                        type="number"
                        min="1"
                        value={recurringConfig.timeAllocation}
                        onChange={(e) => setRecurringConfig(prev => ({ ...prev, timeAllocation: parseInt(e.target.value) || 1 }))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="recurring-type">Repeat</Label>
                      <Select value={recurringConfig.recurringType} onValueChange={(value: any) => setRecurringConfig(prev => ({ ...prev, recurringType: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="recurring-interval">Every</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="recurring-interval"
                          type="number"
                          min="1"
                          value={recurringConfig.recurringInterval}
                          onChange={(e) => setRecurringConfig(prev => ({ ...prev, recurringInterval: parseInt(e.target.value) || 1 }))}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">
                          {recurringConfig.recurringType}(s)
                        </span>
                      </div>
                    </div>

                    {/* Weekly day selection */}
                    {recurringConfig.recurringType === 'weekly' && (
                      <div>
                        <Label htmlFor="weekly-day">On day</Label>
                        <Select 
                          value={recurringConfig.weeklyDayOfWeek?.toString()} 
                          onValueChange={(value) => setRecurringConfig(prev => ({ ...prev, weeklyDayOfWeek: parseInt(value) }))}
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
                    )}

                    {/* Monthly pattern selection */}
                    {recurringConfig.recurringType === 'monthly' && (
                      <div className="space-y-3">
                        <div>
                          <Label>Monthly pattern</Label>
                          <Select 
                            value={recurringConfig.monthlyPattern} 
                            onValueChange={(value: 'date' | 'dayOfWeek') => setRecurringConfig(prev => ({ ...prev, monthlyPattern: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="date">Specific date</SelectItem>
                              <SelectItem value="dayOfWeek">Day of week pattern</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Date-based monthly pattern */}
                        {recurringConfig.monthlyPattern === 'date' && (
                          <div>
                            <Label htmlFor="monthly-date">On the</Label>
                            <Select 
                              value={recurringConfig.monthlyDate?.toString()} 
                              onValueChange={(value) => setRecurringConfig(prev => ({ ...prev, monthlyDate: parseInt(value) }))}
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
                        {recurringConfig.monthlyPattern === 'dayOfWeek' && (
                          <div className="space-y-2">
                            <div>
                              <Label>Week of month</Label>
                              <Select 
                                value={recurringConfig.monthlyWeekOfMonth?.toString()} 
                                onValueChange={(value) => setRecurringConfig(prev => ({ ...prev, monthlyWeekOfMonth: parseInt(value) }))}
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
                            <div>
                              <Label>Day of week</Label>
                              <Select 
                                value={recurringConfig.monthlyDayOfWeek?.toString()} 
                                onValueChange={(value) => setRecurringConfig(prev => ({ ...prev, monthlyDayOfWeek: parseInt(value) }))}
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
                      </div>
                    )}

                    <div className="text-sm text-muted-foreground p-3 bg-muted rounded">
                      <strong>Preview:</strong> {recurringConfig.name} milestones will be created{' '}
                      {recurringConfig.recurringType === 'daily' ? 
                        `every ${recurringConfig.recurringInterval} day${recurringConfig.recurringInterval > 1 ? 's' : ''}` :
                        recurringConfig.recurringType === 'weekly' ?
                        `every ${recurringConfig.recurringInterval} week${recurringConfig.recurringInterval > 1 ? 's' : ''} on ${getDayName(recurringConfig.weeklyDayOfWeek || 1)}` :
                        recurringConfig.monthlyPattern === 'date' ?
                        `every ${recurringConfig.recurringInterval} month${recurringConfig.recurringInterval > 1 ? 's' : ''} on the ${getOrdinalNumber(recurringConfig.monthlyDate || 1)}` :
                        `every ${recurringConfig.recurringInterval} month${recurringConfig.recurringInterval > 1 ? 's' : ''} on the ${getWeekOfMonthName(recurringConfig.monthlyWeekOfMonth || 1)} ${getDayName(recurringConfig.monthlyDayOfWeek || 1)}`
                      } from the project start date{projectContinuous ? ' (continues indefinitely for continuous projects)' : ' until the project end date'}.
                    </div>
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmRecurringMilestone}>
                      Create Recurring Milestones
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Progress Summary */}
              {(projectMilestones.length > 0 || recurringMilestone) && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium">Total Allocation:</span>
                    <span className={`font-medium ${isOverBudget && !projectContinuous ? 'text-orange-600' : 'text-gray-900'}`}>
                      {totalTimeAllocation}h / {projectContinuous && recurringMilestone ? 'N/A' : `${projectEstimatedHours}h`}
                    </span>
                  </div>
                  {isOverBudget && !projectContinuous && (
                    <div className="text-xs text-orange-600 mt-1">
                      Milestone allocations exceed project budget. Consider updating the project budget.
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
