import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, User, Palette, Trash2, Info, ChevronDown, ChevronRight, Folder, Infinity as InfinityIcon, LineChart, StickyNote } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { RichTextEditor } from '../ui/rich-text-editor';
import { ProjectPhaseSection, ProjectInsightsSection, ProjectNotesSection } from '@/components/features/project';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useTimelineContext } from '../../contexts/TimelineContext';
import { ClientSearchInput } from '../shared';
import { calculateProjectTimeMetrics, calculateAutoEstimateHoursPerDay, expandHolidayDates, calculateTotalWorkingDays, clearTimelineCache, ProjectOrchestrator, formatDuration, normalizeToMidnight } from '@/services';
import type { ProjectEvent } from '@/services/calculations/projects/projectEntityCalculations';
import { formatDate, formatDateForInput } from '@/utils/dateFormatUtils';
import { useToast } from '@/hooks/use-toast';
import { StandardModal } from './StandardModal';
import { OKLCH_PROJECT_COLORS, PROJECT_ICONS } from '@/constants';
import { NEUTRAL_COLORS } from '@/constants/colors';
import type { Project, Phase } from '@/types/core';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
import { TabComponent } from '../shared';
import { supabase } from '@/integrations/supabase/client';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  groupId?: string;
  rowId?: string;
}

export function ProjectModal({ isOpen, onClose, projectId, groupId, rowId }: ProjectModalProps) {
  // Debug toggle
  const DEBUG = false;
  const dlog = useCallback((...args: unknown[]) => { if (DEBUG) console.log(...args); }, [DEBUG]);
  // Debug: Identify which modal instance this is
  const modalType = projectId ? 'EDIT' : 'CREATE';
  dlog(`🔍 ${modalType} Modal render:`, { isOpen, projectId, groupId, rowId });
  const { projects, groups, rows, updateProject, addProject, deleteProject, creatingNewProject, milestones, addMilestone, deleteMilestone } = useProjectContext();
  type AddMilestoneInput = Parameters<typeof addMilestone>[0];
  const { setCurrentView } = useTimelineContext();
  const { events, holidays } = usePlannerContext();
  const { settings } = useSettingsContext();
  const { toast } = useToast();
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
  dlog('🔍 ProjectModal props:', { 
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
  dlog('🔍 ProjectModal state:', { 
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  // State for tab navigation
  const [activeTab, setActiveTab] = useState<'estimate' | 'progress' | 'notes'>('estimate');
  // State for collapsible sections (kept for backwards compatibility, but no longer used with tabs)
  const [isInsightsExpanded, setIsInsightsExpanded] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(true);
  // State for milestones in new projects
  const [localProjectPhases, setLocalProjectPhases] = useState<Array<{
    name: string;
    dueDate: Date;
    endDate: Date;
    timeAllocation: number;
    timeAllocationHours: number;
    projectId: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    isNew?: boolean;
  }>>([]);
  // State to track recurring milestone from MilestoneManager
  const [recurringMilestoneInfo, setRecurringPhaseInfo] = useState<{
    totalAllocation: number;
    hasRecurring: boolean;
  }>({ totalAllocation: 0, hasRecurring: false });
  // Track milestones added during this edit session (for rollback on cancel)
  const [milestonesAddedDuringSession, setMilestonesAddedDuringSession] = useState<string[]>([]);
  // Track if we're saving (to prevent rollback on save) - start as false, set true when saving
  const shouldRollbackRef = React.useRef(true); // Default to rollback unless explicitly saving
  // Preserve last finite end date when toggling continuous
  const previousEndDateRef = React.useRef<Date | null>(null);
  // Reset tracking when modal opens
  useEffect(() => {
    if (isOpen && !isCreating) {
      setMilestonesAddedDuringSession([]);
      shouldRollbackRef.current = true; // Reset to rollback by default
    }
  }, [isOpen, isCreating]);
  // Wrapper for addMilestone that tracks new milestone IDs for rollback
  const trackedAddMilestone = useCallback(async (milestone: AddMilestoneInput, options?: { silent?: boolean }) => {
    const result = await addMilestone(milestone, options);
    // Track the new milestone ID if we're editing (not creating)
    if (!isCreating && result?.id) {
      setMilestonesAddedDuringSession(prev => {
        const updated = [...prev, result.id];
        return updated;
      });
    }
    return result;
  }, [addMilestone, isCreating]);
  const [localValues, setLocalValues] = useState({
    name: '',
    client: '',
    estimatedHours: 40, // Default to 40 hours instead of 0
    notes: '',
    startDate: new Date(),
    endDate: new Date(),
    color: '',
    icon: 'folder',
    continuous: false,
    autoEstimateDays: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true,
    }
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
  const handleRecurringPhaseChange = useCallback((info: { totalAllocation: number; hasRecurring: boolean; }) => {
    setRecurringPhaseInfo(prev => {
      if (prev.totalAllocation === info.totalAllocation && prev.hasRecurring === info.hasRecurring) return prev;
      return info;
    });
  }, []);
  const handleMilestoneLocalValuesUpdate = useCallback((updater: (prev: { autoEstimateDays?: Project['autoEstimateDays'] }) => { autoEstimateDays?: Project['autoEstimateDays'] }) => {
    setLocalValues(prev => ({
      ...prev,
      ...updater({ autoEstimateDays: prev.autoEstimateDays }),
    }));
  }, [setLocalValues]);
  const localPhasesStateMemo = useMemo(() => (
    isCreating ? {
      phases: localProjectPhases,
      setPhases: setLocalProjectPhases
    } : undefined
  ), [isCreating, localProjectPhases]);
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
    continuous: false,
    autoEstimateDays: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true,
    }
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
        continuous: project.continuous ?? false, // Handle null values from database
        autoEstimateDays: project.autoEstimateDays || {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: true,
        }
      };
      setLocalValues(projectValues);
      setOriginalValues(projectValues);
      if (!project.continuous && project.endDate) {
        previousEndDateRef.current = new Date(project.endDate);
      }
      // Clear local milestones for existing projects
      setLocalProjectPhases([]);
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
        continuous: false,
        autoEstimateDays: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: true,
        }
      };
      setLocalValues(defaultValues);
      setOriginalValues(defaultValues);
      previousEndDateRef.current = defaultValues.endDate;
      // Reset milestones for new projects
      setLocalProjectPhases([]);
    }
  }, [project, isCreating, creatingNewProject]);
  // Handle smooth modal closing - just call onClose, AnimatePresence will handle the animation
  const handleClose = useCallback(async () => {
    // If editing (not creating) and should rollback, delete milestones added during this session
    if (!isCreating && shouldRollbackRef.current && milestonesAddedDuringSession.length > 0) {
      for (const milestoneId of milestonesAddedDuringSession) {
        try {
          await deleteMilestone(milestoneId, { silent: true });
        } catch (error) {
          console.error('[ProjectModal] Failed to rollback milestone:', milestoneId, error);
        }
      }
      setMilestonesAddedDuringSession([]);
    }
    // Reset rollback flag for next open
    shouldRollbackRef.current = true;
    onClose();
  }, [onClose, isCreating, milestonesAddedDuringSession, deleteMilestone]);
  // Handle creating the new project
  const handleCreateProject = useCallback(async () => {
    // Prevent double submission
    if (isSubmitting) {
      return;
    }
    const gid = resolvedGroupId ?? groupId;
    const rid = resolvedRowId ?? rowId;
    if (!gid || gid === '') {
      toast({
        title: "Error",
        description: "Please select a group for this project",
        variant: "destructive",
      });
      return;
    }

    if (isCreating && gid) {
      setIsSubmitting(true);
      try {
        // Use ProjectOrchestrator for complex creation workflow
        // The orchestrator's ensureClientExists will automatically find or create the client
        const result = await ProjectOrchestrator.executeProjectCreationWorkflow(
          {
            name: localValues.name.trim(),
            client: localValues.client.trim(),
            startDate: localValues.startDate,
            endDate: localValues.continuous ? undefined : localValues.endDate,
            estimatedHours: localValues.estimatedHours,
            groupId: gid,
            rowId: rid,
            color: localValues.color || OKLCH_PROJECT_COLORS[0],
            notes: localValues.notes,
            icon: localValues.icon,
            continuous: localValues.continuous,
            autoEstimateDays: localValues.autoEstimateDays,
            phases: localProjectPhases
          },
          {
            addProject,
            addMilestone: async (data: Partial<Phase>, options?: { silent?: boolean }) => {
              await addMilestone(data as AddMilestoneInput, options);
            }
          }
        );
        if (result.success) {
          // Show success toast only after everything is complete
          toast({
            title: "Success",
            description: "Project created successfully",
          });
          // Show warnings if any dates were auto-adjusted
          if (result.warnings && result.warnings.length > 0) {
            result.warnings.forEach(warning => {
              toast({
                title: "Auto-adjustment",
                description: warning,
                variant: "default",
              });
            });
          }
          // Don't rollback on successful save
          shouldRollbackRef.current = false;
          handleClose();
        } else {
          // Handle orchestrator errors
          const errorMessage = result.errors?.join(', ') || 'Project creation failed';
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } catch (error) {
        ErrorHandlingService.handle(error, { source: 'ProjectModal', action: 'Failed to create project:' });
        toast({
          title: "Error", 
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [resolvedGroupId, groupId, resolvedRowId, rowId, isCreating, localValues.name, localValues.client, localValues.startDate, localValues.endDate, localValues.estimatedHours, localValues.color, localValues.notes, localValues.icon, localValues.continuous, localValues.autoEstimateDays, localProjectPhases, addProject, addMilestone, toast, handleClose, isSubmitting]);
  // Handle deleting the project
  const handleDeleteProject = () => {
    if (projectId && projectId !== '') {
      deleteProject(projectId);
      handleClose();
    }
  };
  // Handle canceling changes - just close without saving
  const handleCancel = useCallback(() => {
    // For existing projects, restore original values in local state
    // (the database still has the original values, so no update needed)
    if (!isCreating && project && projectId) {
      setLocalValues(originalValues);
    }
    // Just close - any changes in localValues are discarded
    handleClose();
  }, [isCreating, project, projectId, originalValues, handleClose]);
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
    // For existing projects, save any changes made in the modal
    if (!isCreating && projectId) {
      // Check if there are any changes compared to original values
      const hasChanges = 
        localValues.color !== originalValues.color ||
        localValues.icon !== originalValues.icon;
      if (hasChanges) {
        // Save the changes
        await updateProject(projectId, {
          color: localValues.color,
          icon: localValues.icon
        });
      }
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
    }
    // Close modal - don't rollback on successful save
    shouldRollbackRef.current = false;
  dlog('🎯 Closing modal after save');
    handleClose();
  }, [isCreating, handleCreateProject, handleClose, projectId, groupId, rowId, resolvedGroupId, resolvedRowId, dlog, toast, localValues, originalValues, updateProject]);
  // Calculate project time metrics using real data
  const metrics = useMemo(() => {
    const fallbackProject: Project = {
      id: 'temp',
      name: localValues.name,
      client: localValues.client,
      clientId: project?.clientId ?? '',
      startDate: localValues.startDate,
      endDate: localValues.endDate,
      estimatedHours: localValues.estimatedHours,
  color: localValues.color || '#000000',
  groupId: project?.groupId ?? groupId ?? '',
  rowId: rowId || project?.rowId,
      notes: localValues.notes,
      icon: localValues.icon,
      continuous: localValues.continuous,
      autoEstimateDays: localValues.autoEstimateDays,
      userId: project?.userId ?? '',
      createdAt: project?.createdAt ?? new Date(),
      updatedAt: project?.updatedAt ?? new Date(),
  status: project?.status ?? 'current',
  phases: project?.phases ?? [],
    };
    const currentProject = project ?? fallbackProject;
    const projectEvents: ProjectEvent[] = events
      .filter(event => !!event.projectId)
      .map(event => ({
        id: event.id,
        startTime: event.startTime,
        endTime: event.endTime,
        completed: event.completed,
        projectId: event.projectId!
      }));

    return calculateProjectTimeMetrics(currentProject, projectEvents, holidays, new Date());
  }, [project, localValues.name, localValues.client, localValues.startDate, localValues.endDate, localValues.estimatedHours, localValues.color, localValues.notes, localValues.icon, localValues.continuous, localValues.autoEstimateDays, groupId, rowId, events, holidays]);
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
    const displayValue = formatAsTime ? formatDuration(value) : value;
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
  const handleSaveProperty = (property: string, value: unknown) => {
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
      if (property === 'startDate' && localValues.endDate && value instanceof Date && value > localValues.endDate) {
        setLocalValues(prev => ({ ...prev, [property]: value, endDate: value }));
      } else if (property === 'endDate' && localValues.startDate && value instanceof Date && value < localValues.startDate) {
        setLocalValues(prev => ({ ...prev, [property]: value, startDate: value }));
      } else {
        setLocalValues(prev => ({ ...prev, [property]: value }));
      }
    } else if (projectId && projectId !== '') {
      // Validate date ranges for existing projects - use silent mode to prevent toasts
      if (property === 'startDate' && localValues.endDate && value instanceof Date && value > localValues.endDate) {
        // If start date is after end date, adjust end date to match
        updateProject(projectId, { [property]: value, endDate: value }, { silent: true });
        setLocalValues(prev => ({ ...prev, [property]: value, endDate: value }));
      } else if (property === 'endDate' && localValues.startDate && value instanceof Date && value < localValues.startDate) {
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
    // Update local state immediately for visual feedback
    setLocalValues(prev => ({ ...prev, color }));
    // Note: Changes are saved when user clicks "Create Project" or "Update Project"
  };
  const handleIconChange = (icon: string) => {
    // Update local state immediately for visual feedback
    setLocalValues(prev => ({ ...prev, icon }));
    // Note: Changes are saved when user clicks "Create Project" or "Update Project"
  };
  const handleNotesChange = (value: string) => {
    setLocalValues(prev => ({ ...prev, notes: value }));
    // Auto-save notes for existing projects only - use silent mode to prevent toasts
    if (!isCreating && projectId && projectId !== '') {
      updateProject(projectId, { notes: value }, { silent: true });
    }
  };
  type AutoEstimateDays = Project['autoEstimateDays'];

  // Handle auto-estimate days changes
  const handleAutoEstimateDaysChange = useCallback((newAutoEstimateDays: AutoEstimateDays) => {
    setLocalValues(prev => ({ ...prev, autoEstimateDays: newAutoEstimateDays }));
    if (!isCreating && projectId) {
      updateProject(projectId, { autoEstimateDays: newAutoEstimateDays }, { silent: true });
      // Clear timeline cache to ensure UI updates immediately
      clearTimelineCache();
    }
  }, [isCreating, projectId, updateProject]);
  const getFarFutureDate = useCallback(() => {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 100);
    return farFuture;
  }, []);
  const handleContinuousToggle = useCallback(async () => {
    const newContinuous = !localValues.continuous;
    if (newContinuous) {
      // Store the last finite end date so we can restore it later
      previousEndDateRef.current = localValues.endDate;
      const farFuture = getFarFutureDate();
      setLocalValues(prev => ({ ...prev, continuous: true, endDate: farFuture }));
      // Auto-save for existing projects - pass endDate undefined to satisfy domain rules
      if (!isCreating && projectId && projectId !== '') {
        try {
          await updateProject(projectId, { continuous: true, endDate: undefined }, { silent: true });
        } catch (error) {
          // Errors are handled centrally; keep local state as-is to avoid toast loops
        }
      }
    } else {
      const fallbackEndDate = previousEndDateRef.current || (() => {
        const fromStart = new Date(localValues.startDate);
        fromStart.setDate(fromStart.getDate() + 7);
        return fromStart;
      })();
      const safeEndDate = fallbackEndDate < localValues.startDate ? localValues.startDate : fallbackEndDate;
      setLocalValues(prev => ({ ...prev, continuous: false, endDate: safeEndDate }));
      if (!isCreating && projectId && projectId !== '') {
        try {
          await updateProject(projectId, { continuous: false, endDate: safeEndDate }, { silent: true });
        } catch (error) {
          // Errors are handled centrally; keep local state as-is to avoid toast loops
        }
      }
    }
  }, [getFarFutureDate, isCreating, localValues.continuous, localValues.endDate, localValues.startDate, projectId, updateProject]);
  const handleGroupChange = (newGroupId: string) => {
    if (!isCreating && projectId && projectId !== '') {
      // For existing projects, update the group - use silent mode to prevent toasts
      updateProject(projectId, { groupId: newGroupId }, { silent: true });
    } else if (isCreating) {
      // For new projects, update the resolved group ID
      setResolvedGroupId(newGroupId);
    }
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
    // Get relevant milestones
    const relevantPhases = isCreating
      ? localProjectPhases
      : milestones.filter(p => projectId && m.projectId === projectId);
    // Calculate disabled date ranges based on milestone constraints
    const getDisabledDates = () => {
      if (!relevantPhases || relevantPhases.length === 0) {
        return (date: Date) => false; // No restrictions if no milestones
      }
      if (property === 'startDate') {
        // Start date cannot be on or after any milestone
        return (date: Date) => {
          return relevantPhases.some(p => {
            const milestoneDate = normalizeToMidnight(new Date(m.dueDate));
            const normalizedDate = normalizeToMidnight(date);
            return normalizedDate.getTime() >= milestoneDate.getTime();
          });
        };
      } else if (property === 'endDate') {
        // End date cannot be on or before any milestone
        return (date: Date) => {
          return relevantPhases.some(p => {
            const milestoneDate = normalizeToMidnight(new Date(m.dueDate));
            const normalizedDate = normalizeToMidnight(date);
            return normalizedDate.getTime() <= milestoneDate.getTime();
          });
        };
      }
      return (date: Date) => false;
    };
    const handleOpenChange = useCallback((nextOpen: boolean) => {
      setIsOpen(nextOpen);
    }, []);
    return (
      <div className="min-w-[80px]">
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-10 text-sm justify-start text-left font-normal px-3 !bg-white"
            >
              <CalendarIcon className="mr-2 h-3 w-3" />
              {formatDate(value)}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0"
            align="start"
          >
            {relevantPhases && relevantPhases.length > 0 && (
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
                  Milestones: {relevantPhases
                    .map(p => formatDate(new Date(m.dueDate)))
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
                milestone: (date) => relevantPhases.some(p => {
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
            />
          </PopoverContent>
        </Popover>
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
  const hasRecurring = recurringMilestoneInfo.hasRecurring;
  const displayValue = hasRecurring ? 'N/A' : `${value}h`;
  const isOverBudget = !localValues.continuous && hasRecurring && 
             recurringMilestoneInfo.totalAllocation > value;
    return (
      <div className="min-w-[100px]">
        <Label className="text-xs text-muted-foreground mb-1 block">Time Budget</Label>
  {isEditing ? (
          <Input
            type="number"
            defaultValue={value}
            className="h-10 text-sm border-border !bg-white min-w-[100px] max-w-[200px]"
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
            className="h-10 text-sm justify-start text-left font-normal px-3 border border-input rounded-md !bg-white hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center min-w-[100px] max-w-[200px] relative z-20 pointer-events-auto"
            role="button"
            tabIndex={0}
            onMouseDown={(e) => { if (!hasRecurring) { e.preventDefault(); e.stopPropagation(); setEditingProperty(property); } }}
            onKeyDown={(e) => { if (!hasRecurring && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setEditingProperty(property); } }}
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
    return (
      <div style={{ width: '250px' }}>
        <Select value={currentGroupId || undefined} onValueChange={onGroupChange} disabled={disabled}>
          <SelectTrigger 
            className="h-10 text-sm relative z-10 pointer-events-auto !bg-white"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <SelectValue placeholder="Select Group" />
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
    value: Date | number | string;
    property: string;
    type?: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => {
    const isEditing = editingProperty === property;
    const dateValue = value as Date;
    const numberValue = typeof value === 'number' ? value : 0;
    const textValue = typeof value === 'string' ? value : '';
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
                {formatDate(dateValue)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateValue}
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
            defaultValue={type === 'number' ? numberValue : textValue}
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
              {type === 'number' ? `${numberValue} hours` : 
               textValue || 'Click to add...'}
            </div>
          </div>
        )}
      </div>
    );
  };
  const modalKey = projectId || (isCreating ? `create-${groupId}` : 'modal');
  return (
    <>
      <StandardModal
  isOpen={isOpen && (!!project || isCreating)}
        onClose={handleClose}
        title={isCreating ? 'Create Project' : 'Edit Project'}
        size="project"
        contentClassName=""
        primaryAction={{
          label: isCreating ? "Create Project" : "Update Project",
          onClick: handleConfirm,
          disabled: !localValues.name?.trim() || !localValues.client?.trim() || isSubmitting
        }}
        secondaryAction={{
          label: "Cancel",
          onClick: handleCancel
        }}
        destructiveAction={(!isCreating && project) ? {
          label: "Delete Project",
          onClick: () => setShowDeleteConfirm(true)
        } : undefined}
      >
        {/* Project Details Section */}
        <div className="px-8 py-6 bg-stone-100">
          <div className="space-y-4">
            {/* First Row: Group and Date Range with Continuous Toggle */}
            <div className="flex items-center gap-4">
              {/* Group Field */}
              <HeaderGroupField
                currentGroupId={project?.groupId || resolvedGroupId}
                onGroupChange={handleGroupChange}
                disabled={false}
              />
              {/* Date Range - same width as client field */}
              <div style={{ width: '250px' }} className="flex items-center gap-2">
                <HeaderDateField
                  value={localValues.startDate}
                  property="startDate"
                />
                <span className="text-muted-foreground">→</span>
                {localValues.continuous ? (
                  <div className="flex items-center gap-1 px-3 py-2 h-10 rounded border border-input bg-white text-muted-foreground">
                    <InfinityIcon className="w-3 h-3" />
                    <span className="text-sm">Continuous</span>
                  </div>
                ) : (
                  <HeaderDateField
                    value={localValues.endDate}
                    property="endDate"
                  />
                )}
              </div>
              {/* Continuous Toggle */}
              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 p-0"
                      onClick={handleContinuousToggle}
                    >
                      <InfinityIcon className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Make continuous</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {/* Second Row: Project Name, Client, and Icon */}
            <div className="flex items-center gap-4">
              {/* Project Name Field */}
              <div style={{ width: '250px' }}>
                {editingTitle ? (
                  <Input
                    defaultValue={localValues.name}
                    placeholder="Add Project Name *"
                    className="h-10 text-sm !bg-white"
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
                  <div 
                    className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors px-3 py-2 h-10 border border-input rounded-md flex items-center text-sm text-muted-foreground bg-white"
                    onClick={() => setEditingTitle(true)}
                  >
                    {localValues.name || 'Add Project Name *'}
                  </div>
                )}
              </div>
              {/* Client Field */}
              <div style={{ width: '250px' }}>
                <ClientSearchInput
                  value={localValues.client}
                  onChange={(value) => {
                    setLocalValues(prev => ({ ...prev, client: value }));
                  }}
                  onClientSelect={(clientName) => {
                    setLocalValues(prev => ({ ...prev, client: clientName }));
                  }}
                  onAddClient={() => {
                    // When clicking "Add New Client", just focus stays on the input
                    // The user can type the new client name
                  }}
                  placeholder="Add Client *"
                  label=""
                  showAddButton={false}
                  className="[&>div]:h-10 [&_input]:h-10 [&_input]:text-sm [&_input]:!bg-white"
                />
              </div>
              {/* Project Icon Field */}
              <Popover open={stylePickerOpen} onOpenChange={setStylePickerOpen}>
                <PopoverTrigger asChild>
                  <div 
                    className="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer relative group transition-all duration-200 hover:scale-105 hover:shadow-md ring-2 ring-transparent hover:ring-primary/20"
                    style={{ backgroundColor: localValues.color || OKLCH_PROJECT_COLORS[0] }}
                  >
                    {(() => {
                      const currentIcon = PROJECT_ICONS.find(icon => icon.name === (localValues.icon || 'folder'));
                      const IconComponent = currentIcon?.component || Folder;
                      return <IconComponent className="w-5 h-5 text-foreground absolute inset-0 m-auto" />;
                    })()}
                    <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center pointer-events-none">
                      <Palette className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </div>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4">
                  <h4 className="text-sm font-medium mb-3">Choose color & icon</h4>
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">Colors</p>
                    <div className="grid grid-cols-6 gap-2">
                      {OKLCH_PROJECT_COLORS.map((color) => (
                        <button
                          key={color}
                          className={`w-8 h-8 rounded border-2 transition-all duration-200 hover:scale-110 ${
                            localValues.color === color 
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
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">Icons</p>
                    <div className="grid grid-cols-6 gap-2">
                      {PROJECT_ICONS.map((icon) => (
                        <button
                          key={icon.name}
                          className={`w-8 h-8 rounded border-2 transition-all duration-200 hover:scale-110 flex items-center justify-center ${
                            localValues.icon === icon.name 
                              ? 'border-primary ring-2 ring-primary/20' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          style={{ backgroundColor: localValues.color || OKLCH_PROJECT_COLORS[0] }}
                          onClick={() => handleIconChange(icon.name)}
                          title={icon.label}
                        >
                          <icon.component className="w-4 h-4 text-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        {/* Tabs Section */}
        <div>
          {/* Tab Headers */}
          <div 
            className="flex items-end border-b border-gray-200 px-8 bg-stone-100"
            style={{
              paddingTop: '4px',
            }}
          >
            <TabComponent
              label="Add Time Est"
              value="estimate"
              isActive={activeTab === 'estimate'}
              onClick={() => setActiveTab('estimate')}
              icon={<Clock className="w-4 h-4" />}
              height={40}
            />
            <TabComponent
              label="See Progress"
              value="progress"
              isActive={activeTab === 'progress'}
              onClick={() => setActiveTab('progress')}
              icon={<LineChart className="w-4 h-4" />}
              height={40}
            />
            <TabComponent
              label="Add Notes"
              value="notes"
              isActive={activeTab === 'notes'}
              onClick={() => setActiveTab('notes')}
              icon={<StickyNote className="w-4 h-4" />}
              height={40}
            />
            {/* Fill remaining space with background */}
            <div className="flex-1 border-b border-gray-200" style={{ marginBottom: '-1px' }} />
          </div>
          {/* Tab Content */}
          <div className="px-8 py-6" style={{ backgroundColor: NEUTRAL_COLORS.gray25 }}>
            {/* Estimate Hours Tab */}
            {activeTab === 'estimate' && (
              <ProjectPhaseSection
                projectId={!isCreating ? projectId : undefined}
                projectEstimatedHours={localValues.estimatedHours}
                projectStartDate={localValues.startDate}
                projectEndDate={localValues.endDate}
                projectContinuous={localValues.continuous}
                onUpdateProjectBudget={handleUpdateProjectBudget}
                onRecurringPhaseChange={handleRecurringPhaseChange}
                localPhasesState={localPhasesStateMemo}
                isCreatingProject={isCreating}
                trackedAddMilestone={!isCreating ? trackedAddMilestone : undefined}
                localValues={localValues}
                setLocalValues={handleMilestoneLocalValuesUpdate}
                onAutoEstimateDaysChange={handleAutoEstimateDaysChange}
                editingProperty={editingProperty}
                setEditingProperty={setEditingProperty}
                handleSaveProperty={handleSaveProperty}
                recurringMilestoneInfo={recurringMilestoneInfo}
              />
            )}
            {/* Track Progress Tab */}
            {activeTab === 'progress' && (
              <div>
                {/* Project Insights */}
                {!isCreating && project && (
                  <div className="mb-6">
                    <ProjectInsightsSection 
                      project={project}
                      events={events}
                      holidays={holidays}
                    />
                  </div>
                )}
                {/* Time Forecasting Dashboard */}
                <div className="bg-gray-50 px-6 py-6 rounded-lg border border-gray-200">
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
              </div>
            )}
            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div>
                <ProjectNotesSection
                  projectId={projectId || ''}
                  notes={localValues.notes}
                  onNotesChange={handleNotesChange}
                />
              </div>
            )}
          </div>
        </div>
      </StandardModal>
        {/* Delete confirmation dialog */}
        {!isCreating && project && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
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
    </>
  );
}