import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, User, Palette, Trash2, Info, Folder, Briefcase, Zap, Target, Lightbulb, Rocket, Star, Heart, Gift, Music, Camera, Code, Book, Gamepad2, Coffee, Home, Building, Car, Plane, Map, Globe, Infinity, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { RichTextEditor, MilestoneManager, ProjectProgressGraph, ProjectNotesSection } from '../projects';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useTimelineContext } from '../../contexts/TimelineContext';
import { calculateProjectTimeMetrics } from '@/services/projects';
import { StandardModal } from './StandardModal';
import { WorkHoursValidationService } from '@/services/timeline/TimelineBusinessLogicService';

// Function to calculate working days remaining until end date
const calculateWorkingDaysRemaining = (endDate: Date, settings: any, holidays: any[]): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const targetEndDate = new Date(endDate);
  targetEndDate.setHours(0, 0, 0, 0);
  
  // If end date is in the past or today, return 0
  if (targetEndDate <= today) {
    return 0;
  }
  
  // If no settings, return 0
  if (!settings?.weeklyWorkHours) {
    return 0;
  }
  
  let workingDays = 0;
  const current = new Date(today);
  current.setDate(current.getDate() + 1); // Start from tomorrow
  
  while (current <= targetEndDate) {
    // Check if it's a holiday
    const isHoliday = holidays.some(holiday => {
      const holidayStart = new Date(holiday.startDate);
      const holidayEnd = new Date(holiday.endDate);
      holidayStart.setHours(0, 0, 0, 0);
      holidayEnd.setHours(0, 0, 0, 0);
      return current >= holidayStart && current <= holidayEnd;
    });
    
    if (!isHoliday) {
      // Check if it's a day with work hours configured
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[current.getDay()] as keyof typeof settings.weeklyWorkHours;
      const workSlots = settings.weeklyWorkHours?.[dayName] || [];
      
      const hasWorkHours = WorkHoursValidationService.hasWorkHoursConfigured(workSlots);
      
      if (hasWorkHours) {
        workingDays++;
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
};

// Function to calculate total working days between start and end dates
const calculateTotalWorkingDays = (startDate: Date, endDate: Date, settings: any, holidays: any[]): number => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  // If no settings, return 0
  if (!settings?.weeklyWorkHours) {
    return 0;
  }
  
  let workingDays = 0;
  const current = new Date(start);
  
  while (current <= end) {
    // Check if it's a holiday
    const isHoliday = holidays.some(holiday => {
      const holidayStart = new Date(holiday.startDate);
      const holidayEnd = new Date(holiday.endDate);
      holidayStart.setHours(0, 0, 0, 0);
      holidayEnd.setHours(0, 0, 0, 0);
      return current >= holidayStart && current <= holidayEnd;
    });
    
    if (!isHoliday) {
      // Check if it's a day with work hours configured
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[current.getDay()] as keyof typeof settings.weeklyWorkHours;
      const workSlots = settings.weeklyWorkHours?.[dayName] || [];
      
      const hasWorkHours = WorkHoursValidationService.hasWorkHoursConfigured(workSlots);
      
      if (hasWorkHours) {
        workingDays++;
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
};

// Function to format time in hours to "Xh Ym" format, rounded to nearest minute
const formatTimeHoursMinutes = (hours: number): string => {
  if (hours === 0) return '0h';
  
  const totalMinutes = Math.round(hours * 60); // Convert to minutes and round
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  
  if (h === 0) {
    return `${m}m`;
  } else if (m === 0) {
    return `${h}h`;
  } else {
    return `${h}h ${m}m`;
  }
};

// OKLCH color palette - matches the one defined in AppContext
const OKLCH_PROJECT_COLORS = [
  'oklch(0.8 0.12 0)',      // Red
  'oklch(0.8 0.12 30)',     // Orange
  'oklch(0.8 0.12 60)',     // Yellow-Orange
  'oklch(0.8 0.12 90)',     // Yellow
  'oklch(0.8 0.12 120)',    // Yellow-Green
  'oklch(0.8 0.12 150)',    // Green
  'oklch(0.8 0.12 180)',    // Cyan-Green
  'oklch(0.8 0.12 210)',    // Cyan
  'oklch(0.8 0.12 240)',    // Blue
  'oklch(0.8 0.12 270)',    // Purple
  'oklch(0.8 0.12 300)',    // Magenta
  'oklch(0.8 0.12 330)',    // Pink
];

// Available icons for projects
const PROJECT_ICONS = [
  { name: 'folder', component: Folder, label: 'Folder' },
  { name: 'briefcase', component: Briefcase, label: 'Briefcase' },
  { name: 'target', component: Target, label: 'Target' },
  { name: 'rocket', component: Rocket, label: 'Rocket' },
  { name: 'lightbulb', component: Lightbulb, label: 'Lightbulb' },
  { name: 'zap', component: Zap, label: 'Zap' },
  { name: 'star', component: Star, label: 'Star' },
  { name: 'heart', component: Heart, label: 'Heart' },
  { name: 'gift', component: Gift, label: 'Gift' },
  { name: 'code', component: Code, label: 'Code' },
  { name: 'book', component: Book, label: 'Book' },
  { name: 'camera', component: Camera, label: 'Camera' },
  { name: 'music', component: Music, label: 'Music' },
  { name: 'gamepad2', component: Gamepad2, label: 'Gaming' },
  { name: 'coffee', component: Coffee, label: 'Coffee' },
  { name: 'home', component: Home, label: 'Home' },
  { name: 'building', component: Building, label: 'Building' },
  { name: 'car', component: Car, label: 'Car' },
  { name: 'plane', component: Plane, label: 'Plane' },
  { name: 'map', component: Map, label: 'Map' },
  { name: 'globe', component: Globe, label: 'Globe' }
];

interface ProjectDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  groupId?: string;
  rowId?: string;
}

export function ProjectDetailModal({ isOpen, onClose, projectId, groupId, rowId }: ProjectDetailModalProps) {
  // Debug toggle
  const DEBUG = false;
  const dlog = (...args: any[]) => { if (DEBUG) console.log(...args); };
  
  // Debug: Identify which modal instance this is
  const modalType = projectId ? 'EDIT' : 'CREATE';
  dlog(`🔍 ${modalType} Modal render:`, { isOpen, projectId, groupId, rowId });
  
  const { projects, groups, rows, updateProject, addProject, deleteProject, creatingNewProject, milestones, addMilestone } = useProjectContext();
  const { setCurrentView } = useTimelineContext();
  const { events, holidays } = usePlannerContext();
  const { settings } = useSettingsContext();
  const project = (projectId && projectId !== '') ? projects.find(p => p.id === projectId) : null;

  // Persist creation context so it doesn't get lost if context re-renders
  const [resolvedGroupId, setResolvedGroupId] = useState<string | undefined>(undefined);
  const [resolvedRowId, setResolvedRowId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) return;
    // Prefer values from creatingNewProject, fall back to props
    const nextGroupId = creatingNewProject?.groupId ?? groupId;
    const nextRowId = creatingNewProject?.rowId ?? rowId;
    if (nextGroupId) {
      setResolvedGroupId(prev => (prev === nextGroupId ? prev : nextGroupId));
    }
    if (nextRowId) {
      setResolvedRowId(prev => (prev === nextRowId ? prev : nextRowId));
    }
  }, [isOpen, creatingNewProject, groupId, rowId]);

  // Creating mode is active when there's no projectId and we have a resolved group to create under
  const isCreating = (!projectId || projectId === '') && !!resolvedGroupId;
  const group = groups.find(g => g.id === (project?.groupId || resolvedGroupId || groupId));

  // Debug logging
  dlog('🔍 ProjectDetailModal props:', { 
    isOpen, 
    projectId, 
    groupId: groupId,
    groupIdType: typeof groupId,
    groupIdValue: `"${groupId}"`,
    groupIdExists: !!groupId,
    rowId: rowId,
    rowIdType: typeof rowId,
    rowIdExists: !!rowId
  });
  dlog('🔍 ProjectDetailModal state:', { 
    isCreating, 
    project, 
    group,
    groupFound: !!group
  });
  
  // Special log for creation mode
  if (DEBUG && isOpen && isCreating) {
    // Debug logging for project creation mode
  }

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingProperty, setEditingProperty] = useState<string | null>(null);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // State for collapsible sections
  const [isInsightsExpanded, setIsInsightsExpanded] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(true);
  
  // Temporary state for style picker
  const [tempColor, setTempColor] = useState('');
  const [tempIcon, setTempIcon] = useState('');
  
  // State for milestones in new projects
  const [localProjectMilestones, setLocalProjectMilestones] = useState<Array<{
    name: string;
    dueDate: Date;
    timeAllocation: number;
    projectId: string;
    order: number;
    isNew?: boolean;
  }>>([]);

  // State to track recurring milestone from MilestoneManager
  const [recurringMilestoneInfo, setRecurringMilestoneInfo] = useState<{
    totalAllocation: number;
    hasRecurring: boolean;
  }>({ totalAllocation: 0, hasRecurring: false });
  
  const [localValues, setLocalValues] = useState({
    name: '',
    client: '',
    estimatedHours: 40, // Default to 40 hours instead of 0
    notes: '',
    startDate: new Date(),
    endDate: new Date(),
    color: '',
    icon: 'folder',
    continuous: false
  });

  // Stable callbacks/objects for MilestoneManager (avoid render loops)
  const handleUpdateProjectBudget = useCallback((newBudget: number) => {
    setLocalValues(prev => {
      if (prev.estimatedHours === newBudget) return prev;
      return { ...prev, estimatedHours: newBudget };
    });
    if (!isCreating && projectId && projectId !== '') {
      updateProject(projectId, { estimatedHours: newBudget }, { silent: true });
    }
  }, [isCreating, projectId, updateProject]);

  const handleRecurringMilestoneChange = useCallback((info: { totalAllocation: number; hasRecurring: boolean; }) => {
    setRecurringMilestoneInfo(prev => {
      if (prev.totalAllocation === info.totalAllocation && prev.hasRecurring === info.hasRecurring) return prev;
      return info;
    });
  }, []);

  const localMilestonesStateMemo = useMemo(() => (
    isCreating ? {
      milestones: localProjectMilestones,
      setMilestones: setLocalProjectMilestones
    } : undefined
  ), [isCreating, localProjectMilestones]);

  // Store original values to restore on cancel
  const [originalValues, setOriginalValues] = useState({
    name: '',
    client: '',
    estimatedHours: 40, // Default to 40 hours instead of 0
    notes: '',
    startDate: new Date(),
    endDate: new Date(),
    color: '',
    icon: 'folder',
    continuous: false
  });

  useEffect(() => {
    if (project) {
      const projectValues = {
        name: project.name,
        client: project.client,
        estimatedHours: project.estimatedHours,
        notes: project.notes || '',
        startDate: new Date(project.startDate),
        endDate: new Date(project.endDate),
        color: project.color,
        icon: project.icon,
        continuous: project.continuous ?? false // Handle null values from database
      };
      
      setLocalValues(projectValues);
      setOriginalValues(projectValues);
      // Clear local milestones for existing projects
      setLocalProjectMilestones([]);
    } else if (isCreating) {
      // Set defaults for new project, using pre-populated dates if available
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      
      const defaultValues = {
        name: '',
        client: '',
        estimatedHours: 40,
        notes: '',
        startDate: creatingNewProject?.startDate || today,
        endDate: creatingNewProject?.endDate || nextWeek,
        color: OKLCH_PROJECT_COLORS[0],
        icon: 'folder',
        continuous: false
      };
      
      setLocalValues(defaultValues);
      setOriginalValues(defaultValues);
      // Reset milestones for new projects
      setLocalProjectMilestones([]);
    }
  }, [project, isCreating, creatingNewProject]);

  // Handle smooth modal closing - just call onClose, AnimatePresence will handle the animation
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle creating the new project
  const handleCreateProject = async () => {
    const gid = resolvedGroupId ?? groupId;
    const rid = resolvedRowId ?? rowId;
  dlog('🚀 handleCreateProject called - resolvedGroupId:', gid, 'resolvedRowId:', rid);
  dlog('🚀 isCreating:', isCreating, 'resolved groupId exists:', !!gid, 'value:', gid);
    
    if (isCreating && gid && gid !== '') {
      try {
        // Validate that we have a valid rowId
        if (!rid) {
          throw new Error('No row selected. Please select a row before creating a project.');
        }

  dlog('🚀 About to call addProject with groupId:', gid, 'rowId:', rid);

        const createdProject = await addProject({
          name: localValues.name.trim() || 'New Project', // Default to "New Project" if no name provided
          client: localValues.client.trim() || 'N/A', // Provide default if client is empty
          startDate: localValues.startDate,
          endDate: localValues.endDate,
          estimatedHours: localValues.estimatedHours,
          groupId: gid,
          rowId: rid, // Use the resolved rowId without fallback
          color: localValues.color || OKLCH_PROJECT_COLORS[0],
          notes: localValues.notes,
          icon: localValues.icon,
          continuous: localValues.continuous
        });

        // If project was created successfully and we have milestones or recurring milestone, save them
        if (createdProject) {
          // Generate individual milestones from recurring milestone configuration
          const milestonesToSave = [...localProjectMilestones];
          
          // Check if MilestoneManager has a recurring milestone that needs to be converted to individual milestones
          // This is a bit of a hack - we need access to the recurring milestone state from MilestoneManager
          // For now, we'll just save the local milestones that were already added
          
          if (milestonesToSave.length > 0) {
            for (const milestone of milestonesToSave) {
              if (milestone.name.trim()) {
                try {
                  await addMilestone({
                    name: milestone.name,
                    dueDate: milestone.dueDate,
                    timeAllocation: milestone.timeAllocation,
                    projectId: createdProject.id,
                    order: milestone.order
                  }, { silent: true }); // Silent mode to prevent individual milestone toasts
                } catch (error) {
                  console.error('Failed to save milestone:', error);
                  // Continue with other milestones even if one fails
                }
              }
            }
          }
        }

        // Show success toast only after everything is complete
        const { toast } = await import('@/hooks/use-toast');
        toast({
          title: "Success",
          description: "Project created successfully",
        });

        handleClose();
      } catch (error) {
        console.error('Failed to create project:', error);
      }
    }
  };

  // Handle deleting the project
  const handleDeleteProject = () => {
    if (projectId && projectId !== '') {
      deleteProject(projectId);
      handleClose();
    }
  };

  // Handle canceling changes - restore original values for existing projects
  const handleCancel = useCallback(() => {
    if (!isCreating && project && projectId) {
      // Restore all original values to the actual project - use silent mode to prevent toasts
      updateProject(projectId, originalValues, { silent: true });
      setLocalValues(originalValues);
    }
    handleClose();
  }, [isCreating, project, projectId, originalValues, updateProject, handleClose]);

  // Handle confirming changes
  const handleConfirm = useCallback(async () => {
  dlog('🎯 handleConfirm clicked', {
      isCreating,
      projectId,
      groupIdProp: groupId,
      rowIdProp: rowId,
      resolvedGroupId,
      resolvedRowId
    });

    // Prefer explicit creation if we have no projectId and a resolved group
    if ((!projectId || projectId === '') && resolvedGroupId) {
      return handleCreateProject();
    }

    // Fallback to previous flag check
    if (isCreating) {
      return handleCreateProject();
    }

    // For existing projects, show a success toast when confirming
    if (!isCreating && projectId) {
      const { toast } = await import('@/hooks/use-toast');
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
    }

    // Otherwise treat as edit modal and just close
  dlog('🎯 Not in create mode; closing modal');
    handleClose();
  }, [isCreating, handleCreateProject, handleClose, projectId, groupId, rowId, resolvedGroupId, resolvedRowId]);

  // Avoid early returns here to keep hook order consistent across renders

  // Calculate project time metrics using real data
  const currentProject = project || {
    id: 'temp',
    name: localValues.name,
    client: localValues.client,
    startDate: localValues.startDate,
    endDate: localValues.endDate,
    estimatedHours: localValues.estimatedHours,
    color: localValues.color,
    groupId: groupId || '',
    rowId: rowId || 'work-row-1',
    notes: localValues.notes,
    icon: localValues.icon
  };

  const metrics = useMemo(() => (
    calculateProjectTimeMetrics(currentProject, events, holidays, settings)
  ), [
    currentProject.id,
    currentProject.startDate?.toString?.() ?? '',
    currentProject.endDate?.toString?.() ?? '',
    currentProject.estimatedHours,
    currentProject.continuous as any,
    events.length,
    holidays.length,
    // Minimal settings fingerprint that changes when work hours change
    JSON.stringify(settings?.weeklyWorkHours ?? {})
  ]);

  // Special TimeMetric component for auto-estimate that shows daily breakdown
  const AutoEstimateTimeMetric = ({ 
    label, 
    dailyTime,
    tooltip,
    showInfo = false
  }: {
    label: string;
    dailyTime: string;
    tooltip: string;
    showInfo?: boolean;
  }) => {
    return (
      <div className="bg-white rounded-lg p-4 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            {showInfo && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">{dailyTime}</span>
        </div>
      </div>
    );
  };

  // Time Forecasting Metric component
  const TimeMetric = ({ 
    label, 
    value, 
    unit = 'hrs', 
    editable = false, 
    property = '', 
    tooltip = '',
    showInfo = false,
    actionIcon = null,
    onActionClick = null,
    formatAsTime = false
  }: {
    label: string;
    value: number;
    unit?: string;
    editable?: boolean;
    property?: string;
    tooltip?: string;
    showInfo?: boolean;
    actionIcon?: React.ReactNode;
    onActionClick?: () => void;
    formatAsTime?: boolean;
  }) => {
    const isEditing = editable && editingProperty === property;
    
    // Format the display value based on whether it should be formatted as time
    const displayValue = formatAsTime ? formatTimeHoursMinutes(value) : value;
    const displayUnit = formatAsTime ? '' : unit; // Don't show unit if we're showing formatted time
    
    return (
      <div className="bg-white rounded-lg p-4 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            {showInfo && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {actionIcon && onActionClick && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      onClick={onActionClick}
                    >
                      {actionIcon}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-sm">Go to Planner</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        
        {editable && isEditing ? (
          <Input
            type="number"
            defaultValue={value}
            className="text-3xl font-bold h-auto py-2 border-0 bg-transparent focus-visible:ring-2 focus-visible:ring-primary"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const inputValue = (e.target as HTMLInputElement).value.trim();
                const newValue = inputValue === '' ? value : (parseInt(inputValue) || 0);
                handleSaveProperty(property, newValue);
              } else if (e.key === 'Escape') {
                setEditingProperty(null);
              }
            }}
            onBlur={(e) => {
              const inputValue = e.target.value.trim();
              const newValue = inputValue === '' ? value : (parseInt(inputValue) || 0);
              handleSaveProperty(property, newValue);
            }}
            autoFocus
          />
        ) : (
          <div 
            className={`flex items-baseline gap-2 ${editable ? 'cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors' : ''}`}
            onClick={editable ? () => setEditingProperty(property) : undefined}
          >
            <span className="text-3xl font-bold text-foreground">{displayValue}</span>
            {displayUnit && <span className="text-lg text-muted-foreground">{displayUnit}</span>}
          </div>
        )}
      </div>
    );
  };

  const handleSaveProperty = (property: string, value: any) => {
    // Validate date values
    if ((property === 'startDate' || property === 'endDate') && value instanceof Date) {
      // Check if date is valid
      if (isNaN(value.getTime())) {
        console.warn('Invalid date provided:', value);
        setEditingProperty(null);
        return;
      }
    }

    if (isCreating) {
      // For new projects, just update local state until saved
      if (property === 'startDate' && localValues.endDate && value > localValues.endDate) {
        setLocalValues(prev => ({ ...prev, [property]: value, endDate: value }));
      } else if (property === 'endDate' && localValues.startDate && value < localValues.startDate) {
        setLocalValues(prev => ({ ...prev, [property]: value, startDate: value }));
      } else {
        setLocalValues(prev => ({ ...prev, [property]: value }));
      }
    } else if (projectId && projectId !== '') {
      // Validate date ranges for existing projects - use silent mode to prevent toasts
      if (property === 'startDate' && localValues.endDate && value > localValues.endDate) {
        // If start date is after end date, adjust end date to match
        updateProject(projectId, { [property]: value, endDate: value }, { silent: true });
        setLocalValues(prev => ({ ...prev, [property]: value, endDate: value }));
      } else if (property === 'endDate' && localValues.startDate && value < localValues.startDate) {
        // If end date is before start date, adjust start date to match
        updateProject(projectId, { [property]: value, startDate: value }, { silent: true });
        setLocalValues(prev => ({ ...prev, [property]: value, startDate: value }));
      } else {
        updateProject(projectId, { [property]: value }, { silent: true });
        setLocalValues(prev => ({ ...prev, [property]: value }));
      }
    }
    setEditingProperty(null);
  };

  const handleTitleSave = (newTitle: string) => {
    if (newTitle.trim()) {
      if (isCreating) {
        setLocalValues(prev => ({ ...prev, name: newTitle.trim() }));
      } else if (projectId && projectId !== '') {
        updateProject(projectId, { name: newTitle.trim() }, { silent: true });
        setLocalValues(prev => ({ ...prev, name: newTitle.trim() }));
      }
    }
    setEditingTitle(false);
  };

  const handleColorChange = (color: string) => {
    setTempColor(color);
  };

  const handleIconChange = (icon: string) => {
    setTempIcon(icon);
  };

  const handleStylePickerOpen = () => {
    // Initialize temp values with current values
    setTempColor(project?.color || localValues.color || OKLCH_PROJECT_COLORS[0]);
    setTempIcon(project?.icon || localValues.icon || 'folder');
    setStylePickerOpen(true);
  };

  const handleStyleSave = () => {
    // Apply the changes
    if (isCreating) {
      setLocalValues(prev => ({ ...prev, color: tempColor, icon: tempIcon }));
    } else if (projectId && projectId !== '') {
      updateProject(projectId, { color: tempColor, icon: tempIcon }, { silent: true });
    }
    setStylePickerOpen(false);
  };

  const handleStyleCancel = () => {
    // Reset temp values and close
    setTempColor('');
    setTempIcon('');
    setStylePickerOpen(false);
  };

  const handleNotesChange = (value: string) => {
    setLocalValues(prev => ({ ...prev, notes: value }));
    // Auto-save notes for existing projects only - use silent mode to prevent toasts
    if (!isCreating && projectId && projectId !== '') {
      updateProject(projectId, { notes: value }, { silent: true });
    }
  };

  const handleContinuousToggle = () => {
    const newContinuous = !localValues.continuous;
    setLocalValues(prev => ({ ...prev, continuous: newContinuous }));
    
    // Auto-save for existing projects - use silent mode to prevent toasts
    if (!isCreating && projectId && projectId !== '') {
      updateProject(projectId, { continuous: newContinuous }, { silent: true });
    }
  };

  const handleGroupChange = (newGroupId: string) => {
    if (!isCreating && projectId && projectId !== '') {
      // For existing projects, update the group - use silent mode to prevent toasts
      updateProject(projectId, { groupId: newGroupId }, { silent: true });
    }
    // Note: For new projects, we can't change the group as it's determined by the creation context
  };

  const formatDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Compact date component for header
  const HeaderDateField = ({ 
    value, 
    property, 
    placeholder = 'Date'
  }: {
    value: Date;
    property: string;
    placeholder?: string;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const formatDate = (date: Date) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}`;
    };

    // Get relevant milestones
    const relevantMilestones = isCreating
      ? localProjectMilestones
      : milestones.filter(m => projectId && m.projectId === projectId);
    
    // Calculate disabled date ranges based on milestone constraints
    const getDisabledDates = () => {
      if (!relevantMilestones || relevantMilestones.length === 0) {
        return (date: Date) => false; // No restrictions if no milestones
      }

      if (property === 'startDate') {
        // Start date cannot be on or after any milestone
        return (date: Date) => {
          return relevantMilestones.some(m => {
            const milestoneDate = new Date(m.dueDate);
            milestoneDate.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);
            return date.getTime() >= milestoneDate.getTime();
          });
        };
      } else if (property === 'endDate') {
        // End date cannot be on or before any milestone
        return (date: Date) => {
          return relevantMilestones.some(m => {
            const milestoneDate = new Date(m.dueDate);
            milestoneDate.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);
            return date.getTime() <= milestoneDate.getTime();
          });
        };
      }

      return (date: Date) => false;
    };
    
    return (
      <div className="min-w-[80px]">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-10 text-sm justify-start text-left font-normal px-3"
            >
              <CalendarIcon className="mr-2 h-3 w-3" />
              {formatDate(value)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            {relevantMilestones && relevantMilestones.length > 0 && (
              <div className="p-3 border-b bg-gray-50">
                <div className="text-sm font-medium text-gray-700 mb-1">
                  {property === 'startDate' ? 'Start Date Constraints' : 'End Date Constraints'}
                </div>
                <div className="text-xs text-gray-600">
                  {property === 'startDate' 
                    ? 'Start date must be before all milestones'
                    : 'End date must be after all milestones'
                  }
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Milestones: {relevantMilestones
                    .map(m => formatDate(new Date(m.dueDate)))
                    .join(', ')}
                </div>
              </div>
            )}
            <Calendar
              mode="single"
              selected={value}
              defaultMonth={value} // This makes the calendar open at the set date
              onSelect={(selectedDate) => {
                if (selectedDate) {
                  handleSaveProperty(property, selectedDate);
                  setIsOpen(false);
                }
              }}
              disabled={getDisabledDates()}
              modifiers={{
                // Mark milestone dates in red
                milestone: (date) => relevantMilestones.some(m => {
                  const mDate = new Date(m.dueDate);
                  return mDate.toDateString() === date.toDateString();
                })
              }}
              modifiersStyles={{
                milestone: {
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

  // Compact client field for header
  const HeaderClientField = ({ 
    value, 
    property, 
    placeholder = 'Client'
  }: {
    value: string;
    property: string;
    placeholder?: string;
  }) => {
    const isEditing = editingProperty === property;
    const displayValue = value || placeholder;
    
    return (
      <div className="min-w-[80px]">
        <Label className="text-xs text-muted-foreground mb-1 block">Client</Label>
  {isEditing ? (
          <Input
            type="text"
            defaultValue={value}
            placeholder={placeholder}
            className="h-10 text-sm border-border bg-background min-w-[80px] max-w-[200px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const newValue = (e.target as HTMLInputElement).value;
                handleSaveProperty(property, newValue);
              } else if (e.key === 'Escape') {
                setEditingProperty(null);
              }
            }}
            onBlur={(e) => {
              const newValue = e.target.value;
              handleSaveProperty(property, newValue);
            }}
            autoFocus
          />
        ) : (
          <div
            className="h-10 text-sm justify-start text-left font-normal px-3 border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center min-w-[80px] max-w-[200px] relative z-20 pointer-events-auto"
            role="button"
            tabIndex={0}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setEditingProperty(property); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingProperty(property); } }}
          >
            <span className="truncate">{displayValue}</span>
          </div>
        )}
      </div>
    );
  };

  // Compact budgeted time field for header
  const HeaderBudgetedTimeField = ({ 
    value, 
    property 
  }: {
    value: number;
    property: string;
  }) => {
    const isEditing = editingProperty === property;
    const isContinuousWithRecurring = localValues.continuous && recurringMilestoneInfo.hasRecurring;
    const displayValue = isContinuousWithRecurring ? 'N/A' : `${value}h`;
    const isOverBudget = !localValues.continuous && recurringMilestoneInfo.hasRecurring && 
                       recurringMilestoneInfo.totalAllocation > value;
    
    return (
      <div className="min-w-[100px]">
        <Label className="text-xs text-muted-foreground mb-1 block">Time Budget</Label>
  {isEditing ? (
          <Input
            type="number"
            defaultValue={value}
            className="h-10 text-sm border-border bg-background min-w-[100px] max-w-[200px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const newValue = parseInt((e.target as HTMLInputElement).value) || 0;
                handleSaveProperty(property, newValue);
              } else if (e.key === 'Escape') {
                setEditingProperty(null);
              }
            }}
            onBlur={(e) => {
              const newValue = parseInt(e.target.value) || 0;
              handleSaveProperty(property, newValue);
            }}
            autoFocus
          />
        ) : (
          <div
            className="h-10 text-sm justify-start text-left font-normal px-3 border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center min-w-[100px] max-w-[200px] relative z-20 pointer-events-auto"
            role="button"
            tabIndex={0}
            onMouseDown={(e) => { if (!isContinuousWithRecurring) { e.preventDefault(); e.stopPropagation(); setEditingProperty(property); } }}
            onKeyDown={(e) => { if (!isContinuousWithRecurring && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setEditingProperty(property); } }}
          >
            <span className="truncate">{displayValue}</span>
          </div>
        )}
      </div>
    );
  };

  // Group dropdown for header
  const HeaderGroupField = ({ 
    currentGroupId, 
    onGroupChange,
    disabled = false
  }: {
    currentGroupId?: string;
    onGroupChange: (groupId: string) => void;
    disabled?: boolean;
  }) => {
    const currentGroup = groups.find(g => g.id === currentGroupId);
    const displayValue = currentGroup ? currentGroup.name : 'Select group';
    
    return (
      <div className="min-w-[100px]">
        <Label className="text-xs text-muted-foreground mb-1 block">Group</Label>
        <Select value={currentGroupId || ''} onValueChange={onGroupChange} disabled={disabled}>
          <SelectTrigger 
            className="h-10 text-sm min-w-[100px] max-w-[200px] relative z-10 pointer-events-auto"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <SelectValue placeholder="Select group">
              {displayValue}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const PropertyField = ({ 
    label, 
    value, 
    property, 
    type = 'text',
    icon: Icon 
  }: {
    label: string;
    value: any;
    property: string;
    type?: string;
    icon: any;
  }) => {
    const isEditing = editingProperty === property;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">{label}</Label>
        </div>
        
        {type === 'date' ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formatDate(value)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value}
                onSelect={(selectedDate) => {
                  if (selectedDate) {
                    handleSaveProperty(property, selectedDate);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        ) : isEditing ? (
          <Input
            type={type}
            defaultValue={value}
            className="w-full"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                let newValue;
                if (type === 'number') {
                  newValue = parseInt((e.target as HTMLInputElement).value) || 0;
                } else {
                  newValue = (e.target as HTMLInputElement).value;
                }
                handleSaveProperty(property, newValue);
              } else if (e.key === 'Escape') {
                setEditingProperty(null);
              }
            }}
            onBlur={(e) => {
              let newValue;
              if (type === 'number') {
                newValue = parseInt(e.target.value) || 0;
              } else {
                newValue = e.target.value;
              }
              handleSaveProperty(property, newValue);
            }}
            autoFocus
          />
        ) : (
          <div 
            className="w-full p-3 bg-background border border-input rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => setEditingProperty(property)}
          >
            <div className="text-sm">
              {type === 'number' ? `${value} hours` : 
               value || 'Click to add...'}
            </div>
          </div>
        )}
      </div>
    );
  };

  const modalKey = projectId || (isCreating ? `create-${groupId}` : 'modal');

  return (
    <StandardModal
      isOpen={isOpen && (project || isCreating)}
      onClose={handleClose}
      title={isCreating ? 'Create New Project' : (project?.name || 'Project Details')}
      description={isCreating 
        ? `Create a new project ${group ? `in the ${group.name} group` : ''}.`
        : `View and edit project information, properties, and notes for ${project?.name} ${group ? `in the ${group.name} group` : ''}.`
      }
      size="project"
      fixedHeight={true}
      height="95vh"
    >
      {/* Modal content starts here */}
      <div className="flex flex-col h-full">
        {/* Hidden accessibility elements */}
        <h2 id="project-title" className="sr-only">
          {isCreating ? 'Create New Project' : `Project Details: ${project?.name}`}
        </h2>
        <div id="project-description" className="sr-only">
          {isCreating 
            ? `Create a new project ${group ? `in the ${group.name} group` : ''}.`
            : `View and edit project information, properties, and notes for ${project?.name} ${group ? `in the ${group.name} group` : ''}.`
          }
        </div>

        {/* Header */}
        <div className="px-8 pt-6 pb-2 border-b border-gray-200 flex-shrink-0">
          {/* First row: Project Icon and Name */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Popover open={stylePickerOpen} onOpenChange={setStylePickerOpen}>
                <PopoverTrigger asChild>
                  <div 
                    className="w-8 h-8 rounded-lg flex-shrink-0 cursor-pointer relative group transition-all duration-200 hover:scale-105 hover:shadow-md ring-2 ring-transparent hover:ring-primary/20"
                    style={{ backgroundColor: project?.color || localValues.color || OKLCH_PROJECT_COLORS[0] }}
                    onClick={handleStylePickerOpen}
                  >
                    {(() => {
                      const currentIcon = PROJECT_ICONS.find(icon => icon.name === (project?.icon || localValues.icon || 'folder'));
                      const IconComponent = currentIcon?.component || Folder;
                      return <IconComponent className="w-4 h-4 text-foreground absolute inset-0 m-auto" />;
                    })()}
                    {/* Style picker overlay on hover */}
                    <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center pointer-events-none">
                      <Palette className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </div>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4">
                  <h4 className="text-sm font-medium mb-3">Choose color & icon</h4>
                  
                  {/* Colors section */}
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">Colors</p>
                    <div className="grid grid-cols-6 gap-2">
                      {OKLCH_PROJECT_COLORS.map((color) => (
                        <button
                          key={color}
                          className={`w-8 h-8 rounded border-2 transition-all duration-200 hover:scale-110 ${
                            tempColor === color 
                              ? 'border-primary ring-2 ring-primary/20' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => handleColorChange(color)}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Icons section */}
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">Icons</p>
                    <div className="grid grid-cols-6 gap-2">
                      {PROJECT_ICONS.map((icon) => (
                        <button
                          key={icon.name}
                          className={`w-8 h-8 rounded border-2 transition-all duration-200 hover:scale-110 flex items-center justify-center ${
                            tempIcon === icon.name 
                              ? 'border-primary ring-2 ring-primary/20' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          style={{ backgroundColor: tempColor || project?.color || localValues.color || OKLCH_PROJECT_COLORS[0] }}
                          onClick={() => handleIconChange(icon.name)}
                          title={icon.label}
                        >
                          <icon.component className="w-4 h-4 text-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button 
                      size="sm" 
                      onClick={handleStyleSave}
                      className="flex-1"
                    >
                      Save
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleStyleCancel}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              {editingTitle ? (
                <Input
                  defaultValue={localValues.name}
                  className="border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none text-2xl font-semibold leading-tight"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTitleSave((e.target as HTMLInputElement).value);
                    } else if (e.key === 'Escape') {
                      setEditingTitle(false);
                    }
                  }}
                  onBlur={(e) => {
                    handleTitleSave(e.target.value);
                  }}
                  autoFocus
                />
              ) : (
                <h1 
                  className="cursor-pointer hover:text-muted-foreground transition-colors text-2xl font-semibold leading-tight"
                  onClick={() => setEditingTitle(true)}
                >
                  {localValues.name || 'New Project'}
                </h1>
              )}
            </div>
            
            {/* Insights positioned to align above end date field */}
            {!localValues.continuous && (
              <div className="flex items-end gap-3 mr-12 pointer-events-none">
                <div className="min-w-[80px]">
                  <div className="text-xs text-muted-foreground mb-1 block opacity-0">Start</div>
                </div>
                <span className="mb-1 opacity-0">→</span>
                <div className="min-w-[80px] flex flex-col items-start">
                  {/* Average time per day insight */}
                  <div 
                    className="text-xs text-muted-foreground mb-0.5"
                    style={{ color: localValues.color || OKLCH_PROJECT_COLORS[0] }}
                  >
                    {(() => {
                      const workingDays = calculateTotalWorkingDays(localValues.startDate, localValues.endDate, settings, holidays);
                      if (workingDays === 0) {
                        return 'Avg -';
                      } else {
                        const avgHoursPerDay = localValues.estimatedHours / workingDays;
                        return `Avg ${formatTimeHoursMinutes(avgHoursPerDay)} per day`;
                      }
                    })()}
                  </div>
                  
                  {/* Working days insight */}
                  <div 
                    className="text-xs text-muted-foreground"
                    style={{ color: localValues.color || OKLCH_PROJECT_COLORS[0] }}
                  >
                    {(() => {
                      const workingDays = calculateTotalWorkingDays(localValues.startDate, localValues.endDate, settings, holidays);
                      if (workingDays === 0) {
                        return '0 working days';
                      } else if (workingDays === 1) {
                        return '1 working day';
                      } else {
                        return `${workingDays} working days`;
                      }
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Second row: Group, Client, Budget (left) and Dates (right) */}
          <div className="flex items-end justify-between">
            <div className="flex items-end gap-3 relative z-10 pointer-events-auto">
              <HeaderGroupField
                currentGroupId={project?.groupId || groupId}
                onGroupChange={handleGroupChange}
                disabled={isCreating} // Can't change group when creating
              />
              <HeaderClientField
                value={localValues.client}
                property="client"
                placeholder="Client"
              />
              <HeaderBudgetedTimeField
                value={localValues.estimatedHours}
                property="estimatedHours"
              />
            </div>
            
            {/* Date Range - aligned to the right */}
            <div className="flex items-end gap-3 text-sm">
              <div className="min-w-[80px]">
                <Label className="text-xs text-muted-foreground mb-1 block">Start</Label>
                <HeaderDateField
                  value={localValues.startDate}
                  property="startDate"
                />
              </div>
              <span className="text-muted-foreground mb-1">→</span>
              {localValues.continuous ? (
                <div className="min-w-[100px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">End</Label>
                  <div className="flex items-center gap-1 px-3 py-1 h-10 rounded border border-input bg-background text-muted-foreground">
                    <Infinity className="w-3 h-3" />
                    <span className="text-sm">Continuous</span>
                  </div>
                </div>
              ) : (
                <div className="min-w-[80px]">
                  <div className="mb-1">
                    <Label className="text-xs text-muted-foreground">End</Label>
                  </div>
                  <HeaderDateField
                    value={localValues.endDate}
                    property="endDate"
                  />
                </div>
              )}
              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 p-0 mb-0"
                      onClick={handleContinuousToggle}
                    >
                      <Infinity className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Make continuous</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Milestone Manager */}
        <div className="flex-1 overflow-y-auto">
          <MilestoneManager
            projectId={!isCreating ? projectId : undefined}
            projectEstimatedHours={localValues.estimatedHours}
            projectStartDate={localValues.startDate}
            projectEndDate={localValues.endDate}
            projectContinuous={localValues.continuous}
            onUpdateProjectBudget={handleUpdateProjectBudget}
            onRecurringMilestoneChange={handleRecurringMilestoneChange}
            localMilestonesState={localMilestonesStateMemo}
            isCreatingProject={isCreating}
          />

          {/* Project Insights */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setIsInsightsExpanded(!isInsightsExpanded)}
              className="w-full px-8 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isInsightsExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <h3 className="text-lg font-medium text-gray-900">Project Insights</h3>
              </div>
            </button>
            
            <AnimatePresence>
              {isInsightsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {/* Project Progress Graph */}
                  {!isCreating && (
                    <div className="px-8 py-6 border-b border-gray-200">
                      <ProjectProgressGraph 
                        project={project || {
                          ...localValues,
                          id: projectId || '',
                          groupId: groupId || '',
                          rowId: rowId || ''
                        }}
                        metrics={metrics}
                        events={events}
                        milestones={milestones.filter(m => m.projectId === (projectId || project?.id))}
                      />
                    </div>
                  )}

                  {/* Time Forecasting Dashboard */}
                  <div className="bg-gray-50 px-8 py-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <TimeMetric
                        label="Planned Time"
                        value={metrics.plannedTime}
                        showInfo={true}
                        tooltip="Planned time is time that has been added to your calendar and connected to this project"
                        actionIcon={<CalendarIcon className="w-3 h-3" />}
                        onActionClick={() => {
                          setCurrentView('calendar');
                          handleClose();
                        }}
                        formatAsTime={true}
                      />
                      
                      <TimeMetric
                        label="Completed Time"
                        value={metrics.completedTime}
                        showInfo={true}
                        tooltip="Completed time is time connected to this project that is ticked as done on your calendar"
                        formatAsTime={true}
                      />
                      
                      <AutoEstimateTimeMetric
                        label="Auto-Estimate Time"
                        dailyTime={metrics.originalDailyEstimateFormatted}
                        showInfo={true}
                        tooltip="Auto-estimated time is the total budgeted hours divided by total working days in the project timeframe"
                      />
                      
                      <TimeMetric
                        label="Work Days Left"
                        value={metrics.workDaysLeft}
                        unit="days"
                        showInfo={true}
                        tooltip="Number of work days is less holidays, days with no availability, and blocked days"
                      />

                      <TimeMetric
                        label="Total Work Days"
                        value={metrics.totalWorkDays}
                        unit="days"
                        showInfo={true}
                        tooltip="Total working days in the project timeframe (excluding weekends and holidays)"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notes */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setIsNotesExpanded(!isNotesExpanded)}
              className="w-full px-8 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isNotesExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <h3 className="text-lg font-medium text-gray-900">Notes</h3>
              </div>
            </button>
            
            <AnimatePresence>
              {isNotesExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <ProjectNotesSection
                    projectId={projectId || ''}
                    notes={localValues.notes}
                    onNotesChange={handleNotesChange}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom Confirmation Row - Fixed Footer */}
        <div className="border-t border-gray-200 px-8 py-4 flex-shrink-0 bg-white">
          <div className="flex items-center justify-end gap-3">
            {/* Right-aligned buttons */}
            <Button 
              onClick={handleConfirm}
              className="h-9 px-6 border border-primary"
              style={{ 
                backgroundColor: 'oklch(0.488 0.243 264.376)', 
                color: 'white',
                borderColor: 'oklch(0.488 0.243 264.376)'
              }}
            >
              CONFIRM
            </Button>
            <Button 
              variant="outline"
              onClick={handleCancel}
              className="h-9 px-6 border border-border"
            >
              CANCEL
            </Button>

            {/* Delete button (only for existing projects) */}
            {!isCreating && project && (
              <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="h-9 w-9 border border-border text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Project</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{project.name}"? This action cannot be undone and will also remove all associated calendar events.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete Project
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </StandardModal>
  );
}