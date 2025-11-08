import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle, Calendar as CalendarIcon, RotateCcw, RefreshCw, X, Flag, SquareSplitHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useProjectContext } from '@/contexts/ProjectContext';
import { Milestone } from '@/types/core';
import { Project } from '@/types/core';
import { useToast } from '@/hooks/use-toast';
import { 
  calculateRecurringMilestoneCount, 
  calculateRecurringTotalAllocation, 
  detectRecurringPattern, 
  normalizeToMidnight,
  addDaysToDate,
  // NEW: Unified service imports (replacing legacy MilestoneManagementService)
  UnifiedMilestoneService,
  UnifiedMilestoneEntity,
  // MilestoneOrchestrator, // Deprecated - using ProjectMilestoneOrchestrator instead
  ProjectOrchestrator,
  ProjectMilestoneOrchestrator
} from '@/services';
import { MilestoneRules } from '@/domain/rules/MilestoneRules';
import { supabase } from '@/integrations/supabase/client';
import { getDayName, getOrdinalNumber, getWeekOfMonthName } from '@/utils/dateFormatUtils';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
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
  // Override addMilestone for tracking (e.g., rollback on cancel)
  trackedAddMilestone?: (milestone: any, options?: { silent?: boolean }) => Promise<any>;
  // Auto-estimate days
  localValues?: {
    autoEstimateDays?: {
      monday: boolean;
      tuesday: boolean;
      wednesday: boolean;
      thursday: boolean;
      friday: boolean;
      saturday: boolean;
      sunday: boolean;
    };
  };
  setLocalValues?: (updater: (prev: any) => any) => void;
  onAutoEstimateDaysChange?: (newAutoEstimateDays: any) => void;
  // Budget field props
  editingProperty?: string | null;
  setEditingProperty?: (property: string | null) => void;
  handleSaveProperty?: (property: string, value: any) => void;
  recurringMilestoneInfo?: {
    hasRecurring: boolean;
    totalAllocation: number;
  };
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
  isCreatingProject = false,
  trackedAddMilestone,
  localValues,
  setLocalValues,
  onAutoEstimateDaysChange,
  editingProperty: externalEditingProperty,
  setEditingProperty: externalSetEditingProperty,
  handleSaveProperty: externalHandleSaveProperty,
  recurringMilestoneInfo
}: ProjectMilestoneSectionProps) {
  const { milestones: contextMilestones, addMilestone: contextAddMilestone, updateMilestone, deleteMilestone, showMilestoneSuccessToast, refetchMilestones } = useProjectContext();
  // Use tracked version if provided (for rollback support), otherwise use context version
  const addMilestone = trackedAddMilestone || contextAddMilestone;
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
  // Split milestone (phases) state
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [showSplitWarning, setShowSplitWarning] = useState(false);
  const [showRecurringFromSplitWarning, setShowRecurringFromSplitWarning] = useState(false);
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
  // Handle splitting estimate into phases
  const handleSplitEstimate = async () => {
    // Calculate midpoint date
    const projectDuration = projectEndDate.getTime() - projectStartDate.getTime();
    const midpointTime = projectStartDate.getTime() + (projectDuration / 2);
    const midpointDate = new Date(midpointTime);
    // Create two initial phases
    const phase1: LocalMilestone = {
      id: isCreatingProject ? `phase-1-${Date.now()}` : undefined,
      name: 'Phase 1',
      projectId: projectId || '',
      startDate: projectStartDate,
      endDate: midpointDate,
      dueDate: midpointDate, // For backward compatibility
      timeAllocation: projectEstimatedHours, // First phase gets full budget
      timeAllocationHours: projectEstimatedHours,
      isRecurring: false, // Explicitly mark as non-recurring
      userId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      isNew: true
    };
    const phase2: LocalMilestone = {
      id: isCreatingProject ? `phase-2-${Date.now() + 1}` : undefined,
      name: 'Phase 2',
      projectId: projectId || '',
      startDate: midpointDate,
      endDate: projectEndDate,
      dueDate: projectEndDate, // For backward compatibility
      timeAllocation: 0, // Second phase starts at 0
      timeAllocationHours: 0,
      isRecurring: false, // Explicitly mark as non-recurring
      userId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      isNew: true
    };
    if (isCreatingProject && localMilestonesState) {
      // For new projects, add to local state
      localMilestonesState.setMilestones([phase1, phase2]);
    } else if (projectId) {
      // For existing projects, save to database
      try {
        const result1 = await addMilestone(phase1);
      } catch (error) {
        ErrorHandlingService.handle(error, { source: 'ProjectMilestoneSection', action: '[Split] Failed to save phase 1:' });
        throw error; // Re-throw to stop execution
      }
      try {
        const result2 = await addMilestone(phase2);
      } catch (error) {
        ErrorHandlingService.handle(error, { source: 'ProjectMilestoneSection', action: '[Split] Failed to save phase 2:' });
        throw error; // Re-throw to stop execution
      }
    } else {
      setLocalMilestones([phase1, phase2]);
    }
    setIsSplitMode(true);
    setShowSplitWarning(false);
  };
  // Handle adding a new phase
  const handleAddPhase = async () => {
    const existingPhases = projectMilestones.filter(m => m.startDate !== undefined);
    const nextPhaseNumber = existingPhases.length + 1;
    // Find the last phase to determine start date
    const lastPhase = existingPhases.sort((a, b) => 
      new Date(b.endDate || b.dueDate).getTime() - new Date(a.endDate || a.dueDate).getTime()
    )[0];
    const phaseStartDate = lastPhase ? new Date(lastPhase.endDate || lastPhase.dueDate) : projectStartDate;
    const newPhase: LocalMilestone = {
      id: isCreatingProject ? `phase-${nextPhaseNumber}-${Date.now()}` : undefined,
      name: `Phase ${nextPhaseNumber}`,
      projectId: projectId || '',
      startDate: phaseStartDate,
      endDate: projectEndDate,
      dueDate: projectEndDate, // For backward compatibility
      timeAllocation: 0,
      timeAllocationHours: 0,
      isRecurring: false, // Explicitly mark as non-recurring
      userId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      isNew: true
    };
    if (isCreatingProject && localMilestonesState) {
      localMilestonesState.setMilestones([...localMilestonesState.milestones, newPhase]);
    } else if (projectId) {
      await addMilestone(newPhase);
    } else {
      setLocalMilestones([...localMilestones, newPhase]);
    }
  };
  // Handle initiating split (with warning if milestones exist)
  const handleInitiateSplit = () => {
    const hasExistingMilestones = projectMilestones.length > 0;
    if (hasExistingMilestones) {
      setShowSplitWarning(true);
    } else {
      handleSplitEstimate();
    }
  };
  // Handle deleting existing milestones before split
  const handleDeleteAndSplit = async () => {
    // Delete all existing milestones
    if (isCreatingProject && localMilestonesState) {
      localMilestonesState.setMilestones([]);
    } else {
      for (const milestone of projectMilestones) {
        if (milestone.id) {
          await deleteMilestone(milestone.id);
        }
      }
      setLocalMilestones([]);
    }
    // Clear recurring state
    setRecurringMilestone(null);
    setIsDeletingRecurringMilestone(false);
    // Now create split phases
    await handleSplitEstimate();
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
  // Phase date field component (shows both start and end dates)
  const PhaseDateField = ({ 
    milestone, 
    property,
    isFirst = false,
    isLast = false
  }: {
    milestone: Milestone | LocalMilestone;
    property: 'startDate' | 'endDate';
    isFirst?: boolean;
    isLast?: boolean;
  }) => {
    const isEditing = editingProperty === `${milestone.id}-${property}`;
    const dateValue = property === 'startDate' ? milestone.startDate : (milestone.endDate || milestone.dueDate);
    const displayValue = dateValue ? format(new Date(dateValue), 'MMM dd') : 'Select date';
    // Determine if this field is editable
    const isFixed = (property === 'startDate' && isFirst) || (property === 'endDate' && isLast);
    const promptText = property === 'startDate' 
      ? 'Edit project start date' 
      : 'Edit project end date';
    return (
      <div className="min-w-[100px]">
        <Label className={`text-xs mb-1 block ${isFixed ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
          {property === 'startDate' ? 'Start' : 'End'}
        </Label>
        {isFixed ? (
          <div className="h-10 text-sm px-3 border border-input rounded-md bg-muted/30 flex items-center cursor-not-allowed opacity-60">
            <CalendarIcon className="mr-2 h-3 w-3 text-muted-foreground/50" />
            <span className="text-muted-foreground/70">{displayValue}</span>
          </div>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-10 text-sm justify-start text-left font-normal px-3"
                style={{ width: '100px' }}
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {displayValue}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateValue ? new Date(dateValue) : undefined}
                onSelect={(selectedDate) => {
                  if (selectedDate) {
                    handleSaveMilestoneProperty(milestone.id!, property, selectedDate);
                  }
                }}
                disabled={(date) => {
                  // Validate based on adjacent phases
                  const phases = projectMilestones
                    .filter(m => m.startDate !== undefined)
                    .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime());
                  const currentIndex = phases.findIndex(p => p.id === milestone.id);
                  if (property === 'startDate') {
                    // Start date must be after previous phase end and before current phase end
                    const prevPhase = currentIndex > 0 ? phases[currentIndex - 1] : null;
                    const currentEnd = new Date(milestone.endDate || milestone.dueDate);
                    if (prevPhase) {
                      const prevEnd = new Date(prevPhase.endDate || prevPhase.dueDate);
                      return date < prevEnd || date >= currentEnd;
                    }
                    return date >= currentEnd;
                  } else {
                    // End date must be after current phase start and before next phase start
                    const nextPhase = currentIndex < phases.length - 1 ? phases[currentIndex + 1] : null;
                    const currentStart = new Date(milestone.startDate!);
                    if (nextPhase) {
                      const nextStart = new Date(nextPhase.startDate!);
                      return date <= currentStart || date >= nextStart;
                    }
                    return date <= currentStart;
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )}
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
      const existing = Array.isArray(milestones) ? milestones.filter(m => 
        m.projectId === projectId && 
        m.dueDate >= projectStartDate && 
        m.dueDate <= projectEndDate
      ) : [];
      const newMilestones = localMilestones.filter(m => 'isNew' in m && m.isNew);
      return [...existing, ...newMilestones] as (Milestone | LocalMilestone)[];
    } else {
      // Fallback: just local milestones
      return localMilestones || [];
    }
  }, [milestones, projectId, localMilestones, isCreatingProject, localMilestonesState, projectStartDate, projectEndDate]);
  // Check if project has recurring milestones and reconstruct config
  // NEW SYSTEM: Look for template milestone with isRecurring=true
  // OLD SYSTEM: Fall back to numbered pattern detection for backward compatibility
  // Detect split mode based on milestones having startDate - MOVED UP to run first
  React.useEffect(() => {
    const phaseMilestones = projectMilestones.filter(m => m.startDate !== undefined);
    const shouldBeSplitMode = phaseMilestones.length > 0;
    setIsSplitMode(shouldBeSplitMode);
  }, [projectMilestones]);
  React.useEffect(() => {
    // Check if any milestones have startDate (phases) - if so, don't detect recurring
    const hasPhases = projectMilestones.some(m => m.startDate !== undefined);
    if (recurringMilestone || !projectId || isDeletingRecurringMilestone || hasPhases) return;
    // NEW SYSTEM: First check for template milestone with isRecurring=true
    const templateMilestone = projectMilestones.find(m => m.isRecurring === true);
    if (templateMilestone && templateMilestone.recurringConfig) {
      // Found new-style template milestone - use its configuration
      const config = templateMilestone.recurringConfig;
      setRecurringMilestone({
        id: templateMilestone.id || 'recurring-milestone',
        name: templateMilestone.name,
        timeAllocation: templateMilestone.timeAllocationHours ?? templateMilestone.timeAllocation,
        recurringType: config.type,
        recurringInterval: config.interval,
        projectId,
        isRecurring: true,
        weeklyDayOfWeek: config.weeklyDayOfWeek,
        monthlyPattern: config.monthlyPattern,
        monthlyDate: config.monthlyDate,
        monthlyWeekOfMonth: config.monthlyWeekOfMonth,
        monthlyDayOfWeek: config.monthlyDayOfWeek
      });
      return;
    }
    // OLD SYSTEM: Fall back to pattern detection from numbered milestones
    // Exclude phases (milestones with startDate) from recurring detection
    const recurringPattern = projectMilestones.filter(m => 
      m.name && /\s\d+$/.test(m.name) && m.startDate === undefined // Ends with space and number, but not a phase
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
        const intervalResult = UnifiedMilestoneService.calculateMilestoneInterval(firstDate, secondDate);
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
    // Filter out template milestone and old numbered instances to avoid double-counting
    // Also exclude temporary unsaved milestones
    const nonRecurringMilestones = projectMilestones.filter(m => {
      // Exclude temporary/unsaved milestones (these haven't been saved to DB yet)
      if ('isNew' in m && (m as LocalMilestone).isNew) return false;
      if (typeof m.id === 'string' && m.id.startsWith('temp-')) return false;
      // Exclude NEW template milestones
      if (m.isRecurring) return false;
      // Exclude OLD numbered instances (but not phases)
      if (m.name && /\s\d+$/.test(m.name) && m.startDate === undefined) return false;
      return true;
    });
    const totalAllocated = nonRecurringMilestones.reduce((sum, m) => sum + m.timeAllocation, 0) + totalRecurringAllocation;
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
    const project: Project = {
      id: projectId || 'new',
      name: 'Current Project',
      client: '', // Deprecated field
      clientId: '', // Phase 5B: placeholder for analysis
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
    // Calculate default time allocation based on remaining budget
    const getDefaultTimeAllocation = () => {
      const validMilestones = projectMilestones.filter(m => m.id) as Milestone[];
      const budgetCheck = MilestoneRules.checkBudgetConstraint(
        validMilestones,
        projectEstimatedHours
      );
      // Use remaining budget, but at least 1 hour and at most 8 hours
      const defaultHours = Math.min(8, Math.max(1, Math.floor(budgetCheck.remaining)));
      return defaultHours;
    };
    const defaultHours = getDefaultTimeAllocation();
    const newMilestone: LocalMilestone = {
      id: `temp-${Date.now()}`, // Generate temporary ID for editing
      name: 'New Milestone',
      dueDate: getDefaultMilestoneDate(),
      endDate: getDefaultMilestoneDate(),
      timeAllocation: defaultHours,
      timeAllocationHours: defaultHours,
      projectId: projectId || 'temp', // Use temp for new projects
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
            const created = await addMilestone(milestoneData);
            return created;
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
      // Refetch milestones to ensure UI is in sync
      await refetchMilestones();
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
      ErrorHandlingService.handle(error, { source: 'ProjectMilestoneSection', action: 'Failed to delete milestone:' });
      // Only show error toasts
      toast({
        title: "Error",
        description: "Failed to delete milestone. Please try again.",
        variant: "destructive",
      });
    }
  };
  const handleUpdateMilestone = async (milestoneId: string, updates: Partial<Milestone>) => {
    // Check if this update would exceed budget using service
    if (updates.timeAllocation !== undefined) {
      const validMilestones = projectMilestones.filter(m => m.id) as Milestone[];
      const budgetCheck = UnifiedMilestoneEntity.wouldUpdateExceedBudget(
        validMilestones,
        milestoneId,
        updates.timeAllocation,
        projectEstimatedHours
      );
      if (!budgetCheck.isValid) {
        toast({
          title: "Error",
          description: `Cannot update milestone: Total milestone allocation would exceed project budget (${projectEstimatedHours}h).`,
          variant: "destructive",
        });
        return;
      }
    }
    try {
      await updateMilestone(milestoneId, updates, { silent: true });
      // No success toast - will be handled by modal confirmation
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'ProjectMilestoneSection', action: 'Failed to update milestone:' });
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
    let currentDate = normalizeToMidnight(new Date(projectStartDate));
    let order = 0;
    const endDate = projectContinuous ? 
      addDaysToDate(currentDate, 365) : // 1 year for continuous
      new Date(projectEndDate);
    endDate.setHours(23, 59, 59, 999);
    // Safety limits to prevent runaway generation
    const defaultLimit = projectContinuous ? 10 : 100; // Much smaller defaults
    const limit = Math.min(maxCount || defaultLimit, 1000); // Hard cap at 1000
    // Initialize first occurrence based on pattern
    switch (config.recurringType) {
      case 'daily':
        // First occurrence is project start date + interval
        currentDate = addDaysToDate(currentDate, config.recurringInterval);
        break;
      case 'weekly':
        // Find the first occurrence of the target day on or after project start
        const targetDayOfWeek = config.weeklyDayOfWeek ?? 0; // Default to Sunday if not specified
        const projectStartDay = currentDate.getDay();
        const daysUntilFirstOccurrence = targetDayOfWeek >= projectStartDay
          ? targetDayOfWeek - projectStartDay
          : 7 - projectStartDay + targetDayOfWeek;
        currentDate = addDaysToDate(currentDate, daysUntilFirstOccurrence);
        break;
      case 'monthly':
        if (config.monthlyPattern === 'date') {
          // Find first occurrence of specific date on or after project start
          const targetDate = config.monthlyDate ?? 1;
          currentDate.setDate(targetDate);
          // If we've passed this date in the current month, move to next month
          if (currentDate < projectStartDate) {
            currentDate.setMonth(currentDate.getMonth() + 1);
            currentDate.setDate(targetDate);
          }
        } else {
          // Find first occurrence of day of week pattern
          const targetWeekOfMonth = config.monthlyWeekOfMonth ?? 1;
          const targetDayOfWeek = config.monthlyDayOfWeek ?? 1;
          // Calculate the target date in the current month
          const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const firstDayWeekday = firstDayOfMonth.getDay();
          const daysToAdd = (targetDayOfWeek - firstDayWeekday + 7) % 7;
          const firstOccurrence = 1 + daysToAdd;
          const targetDateInMonth = firstOccurrence + ((targetWeekOfMonth - 1) * 7);
          currentDate.setDate(targetDateInMonth);
          // If we've passed this date, move to next month
          if (currentDate < projectStartDate) {
            currentDate.setMonth(currentDate.getMonth() + 1);
            currentDate.setDate(targetDateInMonth);
          }
        }
        break;
    }
    while (currentDate <= endDate && order < limit) {
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
          currentDate = addDaysToDate(currentDate, config.recurringInterval);
          break;
        case 'weekly':
          // Simply add the interval weeks
          currentDate = addDaysToDate(currentDate, 7 * config.recurringInterval);
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
              const targetDateCalc = firstOccurrence + ((targetWeekOfMonth - 1) * 7);
              // Check if the calculated date exists in the month
              const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
              if (targetDateCalc <= daysInMonth) {
                currentDate.setDate(targetDateCalc);
              } else {
                // If the target week doesn't exist, use the last occurrence
                const lastOccurrence = targetDateCalc - 7;
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
    // Get current milestone count (exclude phases)
    const currentMilestones = projectMilestones.filter(m => 
      m.name && /\s\d+$/.test(m.name) && m.startDate === undefined
    );
    // Safety check: if we already have too many, don't generate more
    if (currentMilestones.length >= 1000) {
      console.warn('Milestone limit reached (1000), skipping generation');
      return;
    }
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
    // Cap estimates at reasonable values
    estimatedTotalMilestones = Math.min(estimatedTotalMilestones, 500);
    // For continuous projects, ensure we have at least 6 months worth
    // For time-bounded projects, only generate what's actually needed
    const targetMilestoneCount = projectContinuous ? 
      Math.min(26, estimatedTotalMilestones) : // At least 6 months, max 26 for continuous
      Math.min(estimatedTotalMilestones, 100); // Max 100 for time-bounded
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
          dueDate: milestone.dueDate,
          timeAllocation: milestone.timeAllocation,
          projectId,
        }, { silent: true })
      );
      await Promise.all(savePromises);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'ProjectMilestoneSection', action: 'Error auto-generating recurring milestones:' });
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
          ErrorHandlingService.handle(error, { source: 'ProjectMilestoneSection', action: 'Error loading stored recurring milestone:' });
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
        estimatedHours: projectEstimatedHours || 0,
        color: '#000000', // Placeholder
        client: '', // Deprecated field (Phase 5B)
        clientId: '', // Phase 5B: placeholder
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
      ErrorHandlingService.handle(error, { source: 'ProjectMilestoneSection', action: 'Error creating recurring milestones:' });
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
    try {
      if (isCreatingProject && localMilestonesState) {
        localMilestonesState.setMilestones([]);
      } else {
        // For existing projects, delete recurring milestone pattern
        // NEW SYSTEM: Delete template milestones with isRecurring=true
        // OLD SYSTEM: Delete numbered instances (name pattern ending with space and number, excluding phases)
        const recurringMilestones = projectMilestones.filter(m => 
          m.isRecurring || (m.name && /\s\d+$/.test(m.name) && m.startDate === undefined)
        );
        // If there's a template (isRecurring=true), delete it first (cascade will handle instances)
        const template = recurringMilestones.find(m => m.isRecurring);
        if (template && template.id && !template.id.startsWith('temp-')) {
          await deleteMilestone(template.id, { silent: true });
          toast({
            title: "Success",
            description: "Recurring milestone deleted successfully",
          });
        } else {
          // No template found - these are orphaned instances
          // Use batch deletion for better performance
          const orphanedIds = recurringMilestones
            .filter(milestone => milestone.id && !milestone.id.startsWith('temp-'))
            .map(m => m.id!);
          if (orphanedIds.length > 0) {
            // Use Supabase batch delete for better performance
            const { error } = await supabase
              .from('milestones')
              .delete()
              .in('id', orphanedIds);
            if (error) throw error;
            // Refetch milestones to update UI
            await refetchMilestones();
            toast({
              title: "Success",
              description: `Deleted ${orphanedIds.length} orphaned milestones`,
            });
          }
        }
      }
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'ProjectMilestoneSection', action: '[ProjectMilestoneSection] Error deleting milestones:' });
      toast({
        title: "Error",
        description: "Failed to delete some milestones. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Clear deletion flag after cleanup is complete
      setIsDeletingRecurringMilestone(false);
    }
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
    <div>
      <div className="pb-6">
              {/* Time Budget Field */}
              {externalEditingProperty !== undefined && externalSetEditingProperty && externalHandleSaveProperty && recurringMilestoneInfo && (
                <div className="mb-6 pb-4 border-b border-gray-200">
                  {(() => {
                    const isEditing = externalEditingProperty === 'estimatedHours';
                    const isContinuousWithRecurring = projectContinuous && recurringMilestoneInfo.hasRecurring;
                    const displayValue = isContinuousWithRecurring ? 'N/A' : `${projectEstimatedHours}h`;
                    return (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Time Budget</Label>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <Input
                              type="number"
                              defaultValue={projectEstimatedHours}
                              className="h-10 text-sm border-border bg-background w-full max-w-[200px]"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const newValue = parseInt((e.target as HTMLInputElement).value) || 0;
                                  externalHandleSaveProperty('estimatedHours', newValue);
                                } else if (e.key === 'Escape') {
                                  externalSetEditingProperty(null);
                                }
                              }}
                              onBlur={(e) => {
                                const newValue = parseInt(e.target.value) || 0;
                                externalHandleSaveProperty('estimatedHours', newValue);
                              }}
                              autoFocus
                            />
                          ) : (
                            <div
                              className="h-10 text-sm justify-start text-left font-normal px-3 border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center w-full max-w-[200px]"
                              role="button"
                              tabIndex={0}
                              onClick={() => { if (!isContinuousWithRecurring) externalSetEditingProperty('estimatedHours'); }}
                              onKeyDown={(e) => { if (!isContinuousWithRecurring && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); externalSetEditingProperty('estimatedHours'); } }}
                            >
                              <span className="truncate">{displayValue}</span>
                            </div>
                          )}
                          {/* Split Estimate and Recurring Estimate Buttons */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleInitiateSplit}
                            className="flex items-center gap-2"
                          >
                            <SquareSplitHorizontal className="w-4 h-4" />
                            Split Estimate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (isSplitMode) {
                                setShowRecurringFromSplitWarning(true);
                              } else if (projectMilestones.length > 0) {
                                setShowRecurringWarning(true);
                              } else {
                                setShowRecurringConfig(true);
                              }
                            }}
                            className="flex items-center gap-2"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Recurring Estimate
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
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
                // NEW SYSTEM: Filter out template milestones with isRecurring=true
                if (milestone.isRecurring) {
                  return false; // Template milestone is shown in recurring panel below
                }
                // OLD SYSTEM: Filter out numbered recurring instances (but not phases)
                if ((recurringMilestone || isDeletingRecurringMilestone) && milestone.name && /\s\d+$/.test(milestone.name) && milestone.startDate === undefined) {
                  return false; // Don't show individual recurring milestones as cards, but keep phases
                }
                return true; // Show regular milestones and phases
              }).map((milestone, index) => {
                const isPhase = milestone.startDate !== undefined;
                const phases = projectMilestones
                  .filter(m => m.startDate !== undefined)
                  .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime());
                const phaseIndex = phases.findIndex(p => p.id === milestone.id);
                const isFirst = phaseIndex === 0;
                const isLast = phaseIndex === phases.length - 1;
                return (
                  <div key={milestone.id || `milestone-${index}`} className="border border-gray-200 rounded-lg p-4 mb-3">
                    <div className="flex items-end justify-between">
                      {/* Left side: Name and Budget */}
                      <div className="flex items-end gap-3">
                        <MilestoneNameField milestone={milestone} />
                        <MilestoneBudgetField milestone={milestone} />
                      </div>
                      {/* Right side: Date(s) and Delete Button */}
                      <div className="flex items-end gap-3">
                        {isPhase ? (
                          <>
                            <PhaseDateField milestone={milestone} property="startDate" isFirst={isFirst} />
                            <span className="text-muted-foreground mb-2">→</span>
                            <PhaseDateField milestone={milestone} property="endDate" isLast={isLast} />
                          </>
                        ) : (
                          <MilestoneDateField milestone={milestone} />
                        )}
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
                              <AlertDialogTitle>Delete {isPhase ? 'Phase' : 'Milestone'}</AlertDialogTitle>
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
                                Delete {isPhase ? 'Phase' : 'Milestone'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                                        dueDate: milestone.dueDate,
                                        timeAllocation: milestone.timeAllocation,
                                        projectId: projectId!,
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
              {/* Add Milestone/Phase Button - Only show when in split mode */}
              {isSplitMode && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    onClick={handleAddPhase}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Phase
                  </Button>
                </div>
              )}
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
              {/* Warning: Split estimate when milestones exist */}
              <AlertDialog open={showSplitWarning} onOpenChange={setShowSplitWarning}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Existing Milestones?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This project has existing milestones. Splitting the estimate will delete all existing milestones and create phases instead. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => {
                        handleDeleteAndSplit();
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete & Split
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {/* Warning: Recurring estimate when in split mode */}
              <AlertDialog open={showRecurringFromSplitWarning} onOpenChange={setShowRecurringFromSplitWarning}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Split Phases?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This project has split phases. Creating recurring milestones will delete all phases. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => {
                        handleDeleteAndSplit();
                        setIsSplitMode(false);
                        setShowRecurringConfig(true);
                        setShowRecurringFromSplitWarning(false);
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Phases & Continue
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
              {/* Auto-Estimate Days Section */}
              {localValues && setLocalValues && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Auto-Estimate Days</h4>
                  <div className="text-sm text-muted-foreground mb-4">
                    Select which days of the week to include when auto-estimating project time. 
                    Unchecked days will be excluded from receiving auto-estimated time, similar to weekends or holidays.
                  </div>
                  {(() => {
                    const autoEstimateDays = localValues.autoEstimateDays || {
                      monday: true,
                      tuesday: true,
                      wednesday: true,
                      thursday: true,
                      friday: true,
                      saturday: true,
                      sunday: true,
                    };
                    const DAYS = [
                      { key: 'monday', label: 'Mon' },
                      { key: 'tuesday', label: 'Tue' },
                      { key: 'wednesday', label: 'Wed' },
                      { key: 'thursday', label: 'Thu' },
                      { key: 'friday', label: 'Fri' },
                      { key: 'saturday', label: 'Sat' },
                      { key: 'sunday', label: 'Sun' },
                    ] as const;
                    const handleDayToggle = (day: keyof typeof autoEstimateDays) => {
                      const newAutoEstimateDays = {
                        ...autoEstimateDays,
                        [day]: !autoEstimateDays[day],
                      };
                      setLocalValues(prev => ({
                        ...prev,
                        autoEstimateDays: newAutoEstimateDays,
                      }));
                      if (onAutoEstimateDaysChange) {
                        onAutoEstimateDaysChange(newAutoEstimateDays);
                      }
                    };
                    const enabledDaysCount = Object.values(autoEstimateDays).filter(Boolean).length;
                    return (
                      <>
                        <div className="grid grid-cols-7 gap-4">
                          {DAYS.map(({ key, label }) => (
                            <div key={key} className="flex flex-col items-center space-y-2">
                              <span className="text-sm font-medium text-gray-700">
                                {label}
                              </span>
                              <Checkbox
                                id={`auto-estimate-${key}`}
                                checked={autoEstimateDays[key]}
                                onCheckedChange={() => handleDayToggle(key)}
                              />
                            </div>
                          ))}
                        </div>
                        {enabledDaysCount === 0 && (
                          <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mt-4">
                            <p className="text-sm text-orange-700">
                              ⚠️ Warning: No days are selected. Auto-estimation will not work properly.
                            </p>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-4">
                          {enabledDaysCount} day{enabledDaysCount !== 1 ? 's' : ''} enabled for auto-estimation
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
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
      </div>
  );
}
