import React, { useState, useEffect } from 'react';
import { Plus, AlertTriangle, SquareSplitHorizontal, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  usePhaseOperations,
  usePhaseBudget,
  useRecurringPhases,
  RecurringPhaseConfig,
  RecurringPhase,
  LocalPhase
} from '@/hooks/phase';
import type { PhaseDTO } from '@/types/core';
import {
  PhaseCard,
  RecurringPhaseCard,
  PhaseConfigDialog
} from '../phases';
import { UnifiedPhaseService, ProjectPhaseOrchestrator, addDaysToDate } from '@/services';
import { PhaseRules } from '@/domain/rules/PhaseRules';

type AutoEstimateDays = {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
};

type LocalValuesState = {
  autoEstimateDays?: AutoEstimateDays;
};

interface ProjectPhaseSectionProps {
  projectId?: string;
  projectEstimatedHours: number;
  projectStartDate: Date;
  projectEndDate: Date;
  projectContinuous?: boolean;
  onUpdateProjectBudget?: (newBudget: number) => void;
  onRecurringPhaseChange?: (info: {
    totalAllocation: number;
    hasRecurring: boolean;
    ensureMilestonesAvailable?: (targetDate?: Date) => Promise<void>;
  }) => void;
  localPhasesState?: {
    phases: LocalPhase[];
    setPhases: (phases: LocalPhase[]) => void;
  };
  isCreatingProject?: boolean;
  trackedAddMilestone?: (milestone: LocalPhase, options?: { silent?: boolean }) => Promise<PhaseDTO | undefined>;
  localValues?: LocalValuesState;
  setLocalValues?: (updater: (prev: LocalValuesState) => LocalValuesState) => void;
  onAutoEstimateDaysChange?: (newAutoEstimateDays: AutoEstimateDays | undefined) => void;
  editingProperty?: string | null;
  setEditingProperty?: (property: string | null) => void;
  handleSaveProperty?: (property: string, value: string | number | boolean | Date | null | undefined) => void;
  recurringMilestoneInfo?: {
    hasRecurring: boolean;
    totalAllocation: number;
  };
}

/**
 * Orchestrates phase management UI
 * Uses hooks for state/logic coordination and components for pure UI
 * Following .cursorrules: thin orchestration layer, delegates to hooks and services
 * Note: Database still uses 'milestones' table for backward compatibility
 */
export function ProjectPhaseSection({
  projectId,
  projectEstimatedHours,
  projectStartDate,
  projectEndDate,
  projectContinuous = false,
  onUpdateProjectBudget,
  onRecurringPhaseChange,
  localPhasesState,
  isCreatingProject = false,
  trackedAddMilestone,
  localValues,
  setLocalValues,
  onAutoEstimateDaysChange,
  editingProperty: externalEditingProperty,
  setEditingProperty: externalSetEditingProperty,
  handleSaveProperty: externalHandleSaveProperty,
  recurringMilestoneInfo
}: ProjectPhaseSectionProps) {
  const { toast } = useToast();

  // State management for UI interactions
  const [editingProperty, setEditingProperty] = useState<string | null>(null);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [isDeletingRecurringPhase, setIsDeletingRecurringPhase] = useState(false);

  // Dialog state
  const [showRecurringConfig, setShowRecurringConfig] = useState(false);
  const [showRecurringWarning, setShowRecurringWarning] = useState(false);
  const [showSplitWarning, setShowSplitWarning] = useState(false);
  const [showRecurringFromSplitWarning, setShowRecurringFromSplitWarning] = useState(false);

  // Recurring configuration state
  const [recurringConfig, setRecurringConfig] = useState<RecurringPhaseConfig>({
    name: 'Milestone',
    timeAllocation: 8,
    recurringType: 'weekly',
    recurringInterval: 1,
    weeklyDayOfWeek: projectStartDate ? projectStartDate.getDay() : 1,
    monthlyPattern: 'date',
    monthlyDate: projectStartDate ? projectStartDate.getDate() : 1,
    monthlyWeekOfMonth: 1,
    monthlyDayOfWeek: projectStartDate ? projectStartDate.getDay() : 1
  });

  // Use hooks for business logic coordination
  const {
    projectPhases,
    localPhases,
    setLocalPhases,
    createPhase,
    updatePhase,
    deletePhase,
    updatePhaseProperty,
    refetchPhases
  } = usePhaseOperations({
    projectId,
    projectEstimatedHours,
    projectStartDate,
    projectEndDate,
    isCreatingProject,
    localPhasesState,
    trackedAddMilestone
  });

  const {
    recurringMilestone,
    setRecurringPhase,
    ensureRecurringPhasesAvailable,
    createRecurringPhases,
    deleteRecurringPhases
  } = useRecurringPhases({
    projectId,
    projectPhases,
    projectStartDate,
    projectEndDate,
    projectContinuous,
    projectEstimatedHours,
    isDeletingRecurringPhase,
    refetchMilestones: refetchPhases,
    isCreatingProject,
    localPhasesState
  });

  const getExclusivityValidation = () => PhaseRules.checkPhaseRecurringExclusivity(projectPhases as PhaseDTO[]);
  const persistedProjectMilestones = projectPhases.filter(
    (phase): phase is PhaseDTO => Boolean(phase.id)
  );

  const { totalRecurringAllocation, budgetAnalysis } = usePhaseBudget({
    projectPhases,
    projectEstimatedHours,
    projectStartDate,
    projectEndDate,
    projectContinuous,
    projectId,
    recurringMilestone
  });

    // Detect split mode based on whether phases exist
  React.useEffect(() => {
    const phaseMilestones = projectPhases.filter(p => p.startDate !== undefined);
    const hasPhases = phaseMilestones.length > 0;
    
    setIsSplitMode(hasPhases);
  }, [projectPhases, recurringMilestone]);

  // Check for overlapping phases and offer to fix them
  const hasOverlappingPhases = React.useMemo(() => {
    const phases = projectPhases.filter(p => p.startDate !== undefined) as PhaseDTO[];
    if (phases.length < 2) return false;
    
    const validation = PhaseRules.validatePhasesContinuity(phases, projectStartDate, projectEndDate);
    return !validation.isValid && validation.errors.some(e => e.includes('Overlap'));
  }, [projectPhases, projectStartDate, projectEndDate]);

  const handleRepairOverlappingPhases = async () => {
    const phases = projectPhases.filter(p => p.startDate !== undefined) as PhaseDTO[];
    const repairs = PhaseRules.repairOverlappingPhases(phases);
    
    if (repairs.length === 0) {
      toast({
        title: "No repairs needed",
        description: "Phases are already correctly sequential",
      });
      return;
    }

    try {
      // Apply all repairs in parallel
      await Promise.all(
        repairs.map(repair => 
          updatePhase(repair.phaseId, repair.updates)
        )
      );

      toast({
        title: "Phases repaired",
        description: `Fixed ${repairs.length} overlapping phase${repairs.length > 1 ? 's' : ''}`,
      });
    } catch (error) {
      toast({
        title: "Error repairing phases",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  // Notify parent of recurring milestone changes
  useEffect(() => {
    if (onRecurringPhaseChange) {
      onRecurringPhaseChange({
        totalAllocation: totalRecurringAllocation,
        hasRecurring: !!recurringMilestone,
        ensureMilestonesAvailable: ensureRecurringPhasesAvailable
      });
    }
  }, [totalRecurringAllocation, recurringMilestone, onRecurringPhaseChange, ensureRecurringPhasesAvailable]);

  // Filter milestones for display
  const displayMilestones = projectPhases.filter(phase => {
    // Hide template milestone (shown in RecurringPhaseCard instead)
    if (phase.isRecurring) return false;
    return true;
  });

  // All milestones are now phases (with startDate and endDate)
  const phases = displayMilestones
    .filter(p => p.startDate !== undefined)
    .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime());

  // Handle splitting estimate into phases
  const handleSplitEstimate = async () => {
    const projectDuration = projectEndDate.getTime() - projectStartDate.getTime();
    const midpointTime = projectStartDate.getTime() + (projectDuration / 2);
    const midpointDate = new Date(midpointTime);

    const halfBudget = projectEstimatedHours / 2;

    // Phase 1 ends on midpoint, Phase 2 starts the day AFTER (no overlap)
    const phase1EndDate = midpointDate;
    const phase2StartDate = new Date(midpointDate.getTime() + (24 * 60 * 60 * 1000));

    const phase1: LocalPhase = {
      id: isCreatingProject ? `phase-1-${Date.now()}` : undefined,
      name: 'Phase 1',
      projectId: projectId || '',
      startDate: projectStartDate,
      endDate: phase1EndDate,
      dueDate: phase1EndDate,
      timeAllocation: halfBudget,
      timeAllocationHours: halfBudget,
      isRecurring: false,
      userId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      isNew: true
    };

    const phase2: LocalPhase = {
      id: isCreatingProject ? `phase-2-${Date.now() + 1}` : undefined,
      name: 'Phase 2',
      projectId: projectId || '',
      startDate: phase2StartDate,
      endDate: projectEndDate,
      dueDate: projectEndDate,
      timeAllocation: halfBudget,
      timeAllocationHours: halfBudget,
      isRecurring: false,
      userId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      isNew: true
    };

    if (isCreatingProject && localPhasesState) {
      localPhasesState.setPhases([phase1, phase2]);
      setIsSplitMode(true);
      setShowSplitWarning(false);
    } else if (projectId) {
      // Create both phases in parallel for faster response (silent - no toast in modal)
      await Promise.all([
        createPhase(phase1, { silent: true }),
        createPhase(phase2, { silent: true })
      ]);
      setIsSplitMode(true);
      setShowSplitWarning(false);
    } else {
      setLocalPhases([phase1, phase2]);
      setIsSplitMode(true);
      setShowSplitWarning(false);
    }
  };

  // Handle adding a new phase
  const handleAddPhase = async () => {
    try {
      const existingPhases = projectPhases.filter(p => p.startDate !== undefined);
      const nextPhaseNumber = existingPhases.length + 1;

      // DOMAIN RULE: Calculate dates for new phase (shrinks last phase)
      const { newPhaseStart, newPhaseEnd, lastPhaseNewEnd } = PhaseRules.calculateNewPhaseDates(
        existingPhases as PhaseDTO[],
        projectEndDate
      );

      const sortedPhases = existingPhases.sort((a, b) =>
        new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime()
      );
      const lastPhase = sortedPhases[sortedPhases.length - 1];

      const newPhase: LocalPhase = {
        id: isCreatingProject ? `phase-${nextPhaseNumber}-${Date.now()}` : undefined,
        name: `Phase ${nextPhaseNumber}`,
        projectId: projectId || '',
        startDate: newPhaseStart,
        endDate: newPhaseEnd,
        dueDate: newPhaseEnd,
  timeAllocation: 0, // Allow placeholder phase with no hours until decided
  timeAllocationHours: 0,
        isRecurring: false,
        userId: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        isNew: true
      };

      // Update last phase to end where new phase starts
      if (lastPhase && lastPhase.id) {
        await updatePhase(lastPhase.id, {
          endDate: lastPhaseNewEnd,
          dueDate: lastPhaseNewEnd
        });
      }

      // Create new phase
      if (isCreatingProject && localPhasesState) {
        // Also update last phase in local state
        if (lastPhase) {
          const updatedPhases = localPhasesState.phases.map(p =>
            p.id === lastPhase.id ? { ...p, endDate: lastPhaseNewEnd, dueDate: lastPhaseNewEnd } : p
          );
          localPhasesState.setPhases([...updatedPhases, newPhase]);
        } else {
          localPhasesState.setPhases([...localPhasesState.phases, newPhase]);
        }
      } else if (projectId) {
        // Silent - no toast when adding phase in modal
        await createPhase(newPhase, { silent: true });
      } else {
        setLocalPhases([...localPhases, newPhase]);
      }
    } catch (error) {
      toast({
        title: "Failed to add phase",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle initiating split (with warning if milestones exist)
  const handleInitiateSplit = () => {
    // DOMAIN RULE: Check mutual exclusivity before creating phases
    const validation = getExclusivityValidation();
    
    // Block if already has recurring template (don't allow mix)
    if (validation.hasRecurringTemplate) {
      toast({
        title: "Cannot create phases",
        description: "Project already has a recurring template. Delete it first to create split phases.",
        variant: "destructive"
      });
      return;
    }
    
    // Block if already has split phases
    if (validation.hasSplitPhases) {
      toast({
        title: "Split phases already exist",
        description: "Use the 'Add Phase' button to add more phases.",
        variant: "destructive"
      });
      return;
    }
    
    // If has other phases, warn before deletion
    if (projectPhases.length > 0) {
      setShowSplitWarning(true);
    } else {
      handleSplitEstimate();
    }
  };

  // Handle deleting existing milestones before split
  const handleDeleteAndSplit = async () => {
    if (isCreatingProject && localPhasesState) {
      localPhasesState.setPhases([]);
    } else {
      // Delete all milestones in parallel for faster response
      const deletePromises = projectPhases
        .filter(p => p.id)
        .map(p => deletePhase(p.id!));
      
      await Promise.all(deletePromises);
      
      // Force refetch to ensure state is in sync
      await refetchPhases();
      
      setLocalPhases([]);
    }

    setRecurringPhase(null);
    setIsDeletingRecurringPhase(false);
    await handleSplitEstimate();
  };

  // Handle confirming recurring milestone creation
  const handleConfirmRecurringPhase = async () => {
    const result = await createRecurringPhases(recurringConfig);
    if (result.success) {
      setShowRecurringConfig(false);
      setShowRecurringWarning(false);
    }
  };

  // Handle deleting recurring phases
  const handleDeleteRecurringPhases = async () => {
    setIsDeletingRecurringPhase(true);
    await deleteRecurringPhases(isCreatingProject, localPhasesState);
    setIsDeletingRecurringPhase(false);
  };

  // Handle updating recurring milestone load
  const handleUpdateRecurringLoad = async (newLoad: number) => {
    if (!recurringMilestone || !projectId) return;

    const result = await ProjectPhaseOrchestrator.updateRecurringPhaseLoad(
      projectId,
      newLoad,
      {
        projectPhases: persistedProjectMilestones,
        recurringMilestone,
        updatePhase: async (id: string, updates: Partial<PhaseDTO>) => {
          await updatePhase(id, updates);
        },
        setRecurringPhase
      }
    );

    if (!result.success) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  // Handle updating recurring milestone pattern
  const handleUpdateRecurringPattern = async (updates: Partial<RecurringPhase>) => {
    if (!recurringMilestone) return;

    const updatedMilestone = { ...recurringMilestone, ...updates };
    setRecurringPhase(updatedMilestone);

    // Delete and recreate with new pattern
    await handleDeleteRecurringPhases();

    const newConfig: RecurringPhaseConfig = {
      name: recurringMilestone.name,
      timeAllocation: recurringMilestone.timeAllocation,
      recurringType: updates.recurringType || recurringMilestone.recurringType,
      recurringInterval: updates.recurringInterval || recurringMilestone.recurringInterval,
      weeklyDayOfWeek: updates.weeklyDayOfWeek,
      monthlyPattern: updates.monthlyPattern,
      monthlyDate: updates.monthlyDate,
      monthlyWeekOfMonth: updates.monthlyWeekOfMonth,
      monthlyDayOfWeek: updates.monthlyDayOfWeek
    };

    await createRecurringPhases(newConfig);
  };

  return (
    <div>
      <div className="pb-6">
        {/* Time Budget Field */}
        {externalEditingProperty !== undefined && externalSetEditingProperty && externalHandleSaveProperty && recurringMilestoneInfo && (
          <div className="mb-6 pb-4 border-b border-gray-200">
            <Label className="text-xs text-muted-foreground mb-1 block">Time Budget</Label>
            <div className="flex items-center gap-4">
              {externalEditingProperty === 'estimatedHours' ? (
                <Input
                  type="number"
                  defaultValue={projectEstimatedHours}
                  className="h-10 text-sm border-border !bg-white w-full max-w-[200px]"
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
                  className="h-10 text-sm justify-start text-left font-normal px-3 border border-input rounded-md !bg-white hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center w-full max-w-[200px]"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!recurringMilestoneInfo.hasRecurring) externalSetEditingProperty('estimatedHours');
                  }}
                  onKeyDown={(e) => {
                    if (!recurringMilestoneInfo.hasRecurring && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      externalSetEditingProperty('estimatedHours');
                    }
                  }}
                >
                  <span className="truncate">
                    {recurringMilestoneInfo.hasRecurring ? 'N/A' : `${projectEstimatedHours}h`}
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <Button
                variant="outline"
                onClick={handleInitiateSplit}
                className="flex items-center gap-2 h-10 shadow-sm"
              >
                <SquareSplitHorizontal className="w-4 h-4" />
                Create Phases
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  // DOMAIN RULE: Check mutual exclusivity before creating recurring template
                  const validation = getExclusivityValidation();
                  
                  // Block if already has split phases (don't allow mix)
                  if (validation.hasSplitPhases && !validation.hasRecurringTemplate) {
                    // Show warning dialog to convert from split to recurring
                    setShowRecurringFromSplitWarning(true);
                    return;
                  }
                  
                  // Block if already has recurring (shouldn't happen, but safety check)
                  if (validation.hasRecurringTemplate) {
                    toast({
                      title: "Recurring template already exists",
                      description: "Delete the existing recurring template before creating a new one.",
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  // Show warning if:
                  // 1. There are existing milestones/phases to delete, OR
                  // 2. There's a project budget set (recurring will replace it)
                  if (projectPhases.length > 0 || projectEstimatedHours > 0) {
                    setShowRecurringWarning(true);
                  } else {
                    setShowRecurringConfig(true);
                  }
                }}
                className="flex items-center gap-2 h-10 shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Recurring Estimate
              </Button>
            </div>
          </div>
        )}

        {/* State Inconsistency Warning - shows when validation detects phases but UI doesn't show them */}
        {(() => {
          const validation = getExclusivityValidation();
          const visiblePhases = phases.length;
          const hasInconsistency = (validation.hasSplitPhases && visiblePhases === 0) || 
                                   (validation.hasRecurringTemplate && !recurringMilestone);
          
          // Don't show warning during deletion operations - state is transitioning
          if (hasInconsistency && !isDeletingRecurringPhase) {
            return (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-red-800 mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Phase data needs to be reset
                      </span>
                    </div>
                    <p className="text-sm text-red-700">
                      This can happen if changes are made quickly. Click below to clear and start fresh.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm('This will delete all phases and recurring templates for this project. Continue?')) {
                        return;
                      }
                      
                      // Delete everything and start fresh
                      const allMilestones = projectPhases.filter(p => p.id);
                      const deletePromises = allMilestones.map(p => deletePhase(p.id!));
                      
                      await Promise.all(deletePromises);
                      await refetchPhases();
                      
                      setLocalPhases([]);
                      setRecurringPhase(null);
                      setIsSplitMode(false);
                      
                      toast({
                        title: "Phases reset",
                        description: "You can now create new phases or recurring template.",
                      });
                    }}
                  >
                    Delete All & Reset
                  </Button>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Overlapping Phases Warning - shows when phases share dates */}
        {hasOverlappingPhases && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-amber-800 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Phases have overlapping dates
                  </span>
                </div>
                <p className="text-sm text-amber-700">
                  Phases should be sequential with no shared days. Click to automatically fix.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={handleRepairOverlappingPhases}
              >
                Fix Overlaps
              </Button>
            </div>
          </div>
        )}

        {/* Over Budget Warning */}
        {budgetAnalysis.isOverBudget && !projectContinuous && !recurringMilestone && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-orange-800">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Phase allocations exceed project budget ({budgetAnalysis.totalAllocated}h / {projectEstimatedHours}h)
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
                onClick={() => {
                  if (onUpdateProjectBudget) {
                    onUpdateProjectBudget(budgetAnalysis.totalAllocated);
                  }
                }}
              >
                Update to {budgetAnalysis.totalAllocated}h
              </Button>
            </div>
            <p className="text-sm text-orange-700 mt-1">
              Consider updating the project budget or adjusting phase allocations.
            </p>
          </div>
        )}

        {/* Phase Milestones (all milestones are now phases with start/end dates) */}
        {phases.map((phase, index) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            projectEstimatedHours={projectEstimatedHours}
            projectContinuous={projectContinuous}
            allPhases={phases}
            isFirst={index === 0}
            isLast={index === phases.length - 1}
            editingProperty={editingProperty}
            onEditPropertyChange={setEditingProperty}
            onUpdateProperty={updatePhaseProperty}
            onDelete={deletePhase}
          />
        ))}

        {/* Recurring Phase Template */}
        {recurringMilestone && (
          <RecurringPhaseCard
            recurringMilestone={recurringMilestone}
            projectEstimatedHours={projectEstimatedHours}
            projectContinuous={projectContinuous}
            projectStartDate={projectStartDate}
            onUpdateLoad={handleUpdateRecurringLoad}
            onUpdatePattern={handleUpdateRecurringPattern}
            onDelete={handleDeleteRecurringPhases}
          />
        )}

        {/* Add Phase Button */}
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
                        <span className="text-sm font-medium text-gray-700">{label}</span>
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
        {(projectPhases.length > 0 || recurringMilestone) && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">Total Allocation:</span>
              <span className={`font-medium ${budgetAnalysis.isOverBudget && !projectContinuous ? 'text-orange-600' : 'text-gray-900'}`}>
                {budgetAnalysis.totalAllocated}h / {projectContinuous && recurringMilestone ? 'N/A' : `${projectEstimatedHours}h`}
              </span>
            </div>
            {budgetAnalysis.isOverBudget && !projectContinuous && (
              <div className="text-xs text-orange-600 mt-1">
                Phase allocations exceed project budget. Consider updating the project budget.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configuration and Warning Dialogs */}
      <PhaseConfigDialog
        type="recurring"
        open={showRecurringConfig}
        onOpenChange={setShowRecurringConfig}
        onConfirm={handleConfirmRecurringPhase}
        projectStartDate={projectStartDate}
        projectContinuous={projectContinuous}
        config={recurringConfig}
        onConfigChange={setRecurringConfig}
      />

      <PhaseConfigDialog
        type="recurring-warning"
        open={showRecurringWarning}
        onOpenChange={setShowRecurringWarning}
        onConfirm={async () => {
          // Delete ALL phases/milestones before creating recurring template
          if (isCreatingProject && localPhasesState) {
            localPhasesState.setPhases([]);
          } else {
            // Delete all milestones in parallel for faster response
            const deletePromises = projectPhases
              .filter(p => p.id)
              .map(p => deletePhase(p.id!));
            
            await Promise.all(deletePromises);
            
            // Force refetch to ensure state is in sync
            await refetchPhases();
            
            setLocalPhases([]);
          }
          setRecurringPhase(null);
          setIsSplitMode(false); // Ensure split mode is off
          setShowRecurringConfig(true);
          setShowRecurringWarning(false);
        }}
        projectStartDate={projectStartDate}
        projectContinuous={projectContinuous}
        projectEstimatedHours={projectEstimatedHours}
      />

      <PhaseConfigDialog
        type="split-warning"
        open={showSplitWarning}
        onOpenChange={setShowSplitWarning}
        onConfirm={handleDeleteAndSplit}
        projectStartDate={projectStartDate}
        projectContinuous={projectContinuous}
      />

      <PhaseConfigDialog
        type="recurring-from-split-warning"
        open={showRecurringFromSplitWarning}
        onOpenChange={setShowRecurringFromSplitWarning}
        onConfirm={async () => {
          // Delete existing split phases before showing recurring config
          if (isCreatingProject && localPhasesState) {
            localPhasesState.setPhases([]);
          } else {
            // Delete all milestones in parallel for faster response
            const deletePromises = projectPhases
              .filter(p => p.id)
              .map(p => deletePhase(p.id!));
            
            await Promise.all(deletePromises);
            
            // Force refetch to ensure state is in sync
            await refetchPhases();
            
            setLocalPhases([]);
          }
          setRecurringPhase(null);
          setIsDeletingRecurringPhase(false);
          setIsSplitMode(false);
          setShowRecurringConfig(true);
          setShowRecurringFromSplitWarning(false);
        }}
        projectStartDate={projectStartDate}
        projectContinuous={projectContinuous}
        projectEstimatedHours={projectEstimatedHours}
      />
    </div>
  );
}
