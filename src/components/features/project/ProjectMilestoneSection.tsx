import React, { useState, useEffect } from 'react';
import { Plus, AlertTriangle, SquareSplitHorizontal, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  useMilestoneOperations,
  useMilestoneBudget,
  useRecurringMilestones,
  RecurringMilestoneConfig,
  LocalMilestone
} from '@/hooks/milestone';
import {
  MilestoneCard,
  PhaseCard,
  RecurringMilestoneCard,
  MilestoneConfigDialog
} from '../phases';
import { UnifiedMilestoneService, ProjectMilestoneOrchestrator, addDaysToDate } from '@/services';

interface ProjectMilestoneSectionProps {
  projectId?: string;
  projectEstimatedHours: number;
  projectStartDate: Date;
  projectEndDate: Date;
  projectContinuous?: boolean;
  onUpdateProjectBudget?: (newBudget: number) => void;
  onRecurringMilestoneChange?: (info: {
    totalAllocation: number;
    hasRecurring: boolean;
    ensureMilestonesAvailable?: (targetDate?: Date) => Promise<void>;
  }) => void;
  localMilestonesState?: {
    milestones: LocalMilestone[];
    setMilestones: (milestones: LocalMilestone[]) => void;
  };
  isCreatingProject?: boolean;
  trackedAddMilestone?: (milestone: any, options?: { silent?: boolean }) => Promise<any>;
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
  editingProperty?: string | null;
  setEditingProperty?: (property: string | null) => void;
  handleSaveProperty?: (property: string, value: any) => void;
  recurringMilestoneInfo?: {
    hasRecurring: boolean;
    totalAllocation: number;
  };
}

/**
 * Orchestrates milestone management UI
 * Uses hooks for state/logic coordination and components for pure UI
 * Following .cursorrules: thin orchestration layer, delegates to hooks and services
 */
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
  const { toast } = useToast();

  // State management for UI interactions
  const [editingProperty, setEditingProperty] = useState<string | null>(null);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [isDeletingRecurringMilestone, setIsDeletingRecurringMilestone] = useState(false);

  // Dialog state
  const [showRecurringConfig, setShowRecurringConfig] = useState(false);
  const [showRecurringWarning, setShowRecurringWarning] = useState(false);
  const [showSplitWarning, setShowSplitWarning] = useState(false);
  const [showRecurringFromSplitWarning, setShowRecurringFromSplitWarning] = useState(false);

  // Recurring configuration state
  const [recurringConfig, setRecurringConfig] = useState<RecurringMilestoneConfig>({
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
    projectMilestones,
    localMilestones,
    setLocalMilestones,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    updateMilestoneProperty,
    refetchMilestones
  } = useMilestoneOperations({
    projectId,
    projectEstimatedHours,
    projectStartDate,
    projectEndDate,
    isCreatingProject,
    localMilestonesState,
    trackedAddMilestone
  });

  const {
    recurringMilestone,
    setRecurringMilestone,
    ensureRecurringMilestonesAvailable,
    createRecurringMilestones,
    deleteRecurringMilestones
  } = useRecurringMilestones({
    projectId,
    projectMilestones,
    projectStartDate,
    projectEndDate,
    projectContinuous,
    projectEstimatedHours,
    isDeletingRecurringMilestone,
    refetchMilestones
  });

  const { totalRecurringAllocation, budgetAnalysis } = useMilestoneBudget({
    projectMilestones,
    projectEstimatedHours,
    projectStartDate,
    projectEndDate,
    projectContinuous,
    projectId,
    recurringMilestone
  });

  // Detect split mode based on milestones having startDate
  useEffect(() => {
    const phaseMilestones = projectMilestones.filter(m => m.startDate !== undefined);
    setIsSplitMode(phaseMilestones.length > 0);
  }, [projectMilestones]);

  // Notify parent of recurring milestone changes
  useEffect(() => {
    if (onRecurringMilestoneChange) {
      onRecurringMilestoneChange({
        totalAllocation: totalRecurringAllocation,
        hasRecurring: !!recurringMilestone,
        ensureMilestonesAvailable: ensureRecurringMilestonesAvailable
      });
    }
  }, [totalRecurringAllocation, recurringMilestone, onRecurringMilestoneChange, ensureRecurringMilestonesAvailable]);

  // Filter milestones for display
  const displayMilestones = projectMilestones.filter(milestone => {
    if (milestone.isRecurring) return false; // Template milestone shown in recurring card
    if ((recurringMilestone || isDeletingRecurringMilestone) && milestone.name && /\s\d+$/.test(milestone.name) && milestone.startDate === undefined) {
      return false; // Don't show individual recurring instances
    }
    return true;
  });

  // Separate phases from regular milestones
  const phases = displayMilestones
    .filter(m => m.startDate !== undefined)
    .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime());
  const regularMilestones = displayMilestones.filter(m => m.startDate === undefined);

  // Handle splitting estimate into phases
  const handleSplitEstimate = async () => {
    const projectDuration = projectEndDate.getTime() - projectStartDate.getTime();
    const midpointTime = projectStartDate.getTime() + (projectDuration / 2);
    const midpointDate = new Date(midpointTime);

    const phase1: LocalMilestone = {
      id: isCreatingProject ? `phase-1-${Date.now()}` : undefined,
      name: 'Phase 1',
      projectId: projectId || '',
      startDate: projectStartDate,
      endDate: midpointDate,
      dueDate: midpointDate,
      timeAllocation: projectEstimatedHours,
      timeAllocationHours: projectEstimatedHours,
      isRecurring: false,
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
      dueDate: projectEndDate,
      timeAllocation: 0,
      timeAllocationHours: 0,
      isRecurring: false,
      userId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      isNew: true
    };

    if (isCreatingProject && localMilestonesState) {
      localMilestonesState.setMilestones([phase1, phase2]);
    } else if (projectId) {
      await createMilestone(phase1);
      await createMilestone(phase2);
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
      dueDate: projectEndDate,
      timeAllocation: 0,
      timeAllocationHours: 0,
      isRecurring: false,
      userId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      isNew: true
    };

    if (isCreatingProject && localMilestonesState) {
      localMilestonesState.setMilestones([...localMilestonesState.milestones, newPhase]);
    } else if (projectId) {
      await createMilestone(newPhase);
    } else {
      setLocalMilestones([...localMilestones, newPhase]);
    }
  };

  // Handle initiating split (with warning if milestones exist)
  const handleInitiateSplit = () => {
    if (projectMilestones.length > 0) {
      setShowSplitWarning(true);
    } else {
      handleSplitEstimate();
    }
  };

  // Handle deleting existing milestones before split
  const handleDeleteAndSplit = async () => {
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

    setRecurringMilestone(null);
    setIsDeletingRecurringMilestone(false);
    await handleSplitEstimate();
  };

  // Handle creating new regular milestone
  const addNewMilestone = () => {
    const getDefaultDate = () => {
      return UnifiedMilestoneService.calculateDefaultMilestoneDate({
        projectStartDate,
        projectEndDate,
        existingMilestones: projectMilestones
      });
    };

    const newMilestone: LocalMilestone = {
      id: `temp-${Date.now()}`,
      name: 'New Milestone',
      dueDate: getDefaultDate(),
      endDate: getDefaultDate(),
      timeAllocation: 8,
      timeAllocationHours: 8,
      projectId: projectId || 'temp',
      userId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      isNew: true
    };

    if (isCreatingProject && localMilestonesState) {
      localMilestonesState.setMilestones([...localMilestonesState.milestones, newMilestone]);
    } else {
      setLocalMilestones(prev => [...prev, newMilestone]);
    }
  };

  // Handle confirming recurring milestone creation
  const handleConfirmRecurringMilestone = async () => {
    const result = await createRecurringMilestones(recurringConfig);
    if (result.success) {
      setShowRecurringConfig(false);
      setShowRecurringWarning(false);
    }
  };

  // Handle deleting recurring milestones
  const handleDeleteRecurringMilestones = async () => {
    setIsDeletingRecurringMilestone(true);
    await deleteRecurringMilestones(isCreatingProject, localMilestonesState);
    setIsDeletingRecurringMilestone(false);
  };

  // Handle updating recurring milestone load
  const handleUpdateRecurringLoad = async (newLoad: number) => {
    if (!recurringMilestone || !projectId) return;

    const result = await ProjectMilestoneOrchestrator.updateRecurringMilestoneLoad(
      projectId,
      newLoad,
      {
        projectMilestones: projectMilestones.filter(m => m.id) as any[],
        recurringMilestone,
        updateMilestone: async (id: string, updates: any) => {
          await updateMilestone(id, updates);
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
    }
  };

  // Handle updating recurring milestone pattern
  const handleUpdateRecurringPattern = async (updates: Partial<any>) => {
    if (!recurringMilestone) return;

    const updatedMilestone = { ...recurringMilestone, ...updates };
    setRecurringMilestone(updatedMilestone);

    // Delete and recreate with new pattern
    await handleDeleteRecurringMilestones();

    const newConfig: RecurringMilestoneConfig = {
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

    await createRecurringMilestones(newConfig);
  };

  return (
    <div>
      <div className="pb-6">
        {/* Time Budget Field */}
        {externalEditingProperty !== undefined && externalSetEditingProperty && externalHandleSaveProperty && recurringMilestoneInfo && (
          <div className="mb-6 pb-4 border-b border-gray-200">
            <Label className="text-xs text-muted-foreground mb-1 block">Time Budget</Label>
            <div className="flex items-center gap-2">
              {externalEditingProperty === 'estimatedHours' ? (
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
                  onClick={() => {
                    const isContinuousWithRecurring = projectContinuous && recurringMilestoneInfo.hasRecurring;
                    if (!isContinuousWithRecurring) externalSetEditingProperty('estimatedHours');
                  }}
                  onKeyDown={(e) => {
                    const isContinuousWithRecurring = projectContinuous && recurringMilestoneInfo.hasRecurring;
                    if (!isContinuousWithRecurring && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      externalSetEditingProperty('estimatedHours');
                    }
                  }}
                >
                  <span className="truncate">
                    {projectContinuous && recurringMilestoneInfo.hasRecurring ? 'N/A' : `${projectEstimatedHours}h`}
                  </span>
                </div>
              )}

              {/* Action Buttons */}
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
        )}

        {/* Over Budget Warning */}
        {budgetAnalysis.isOverBudget && !projectContinuous && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-orange-800">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Milestone allocations exceed project budget ({budgetAnalysis.totalAllocated}h / {projectEstimatedHours}h)
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
              Consider updating the project budget or adjusting milestone allocations.
            </p>
          </div>
        )}

        {/* Regular Milestones */}
        {regularMilestones.map((milestone) => (
          <MilestoneCard
            key={milestone.id}
            milestone={milestone}
            projectEstimatedHours={projectEstimatedHours}
            projectStartDate={projectStartDate}
            projectEndDate={projectEndDate}
            projectContinuous={projectContinuous}
            existingMilestones={projectMilestones}
            editingProperty={editingProperty}
            onEditPropertyChange={setEditingProperty}
            onUpdateProperty={updateMilestoneProperty}
            onDelete={deleteMilestone}
          />
        ))}

        {/* Phase Milestones */}
        {phases.map((milestone, index) => (
          <PhaseCard
            key={milestone.id}
            milestone={milestone}
            projectEstimatedHours={projectEstimatedHours}
            projectContinuous={projectContinuous}
            allPhases={phases}
            isFirst={index === 0}
            isLast={index === phases.length - 1}
            editingProperty={editingProperty}
            onEditPropertyChange={setEditingProperty}
            onUpdateProperty={updateMilestoneProperty}
            onDelete={deleteMilestone}
          />
        ))}

        {/* Recurring Milestone Card */}
        {recurringMilestone && (
          <RecurringMilestoneCard
            recurringMilestone={recurringMilestone}
            projectEstimatedHours={projectEstimatedHours}
            projectContinuous={projectContinuous}
            projectStartDate={projectStartDate}
            onUpdateLoad={handleUpdateRecurringLoad}
            onUpdatePattern={handleUpdateRecurringPattern}
            onDelete={handleDeleteRecurringMilestones}
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
        {(projectMilestones.length > 0 || recurringMilestone) && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">Total Allocation:</span>
              <span className={`font-medium ${budgetAnalysis.isOverBudget && !projectContinuous ? 'text-orange-600' : 'text-gray-900'}`}>
                {budgetAnalysis.totalAllocated}h / {projectContinuous && recurringMilestone ? 'N/A' : `${projectEstimatedHours}h`}
              </span>
            </div>
            {budgetAnalysis.isOverBudget && !projectContinuous && (
              <div className="text-xs text-orange-600 mt-1">
                Milestone allocations exceed project budget. Consider updating the project budget.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configuration and Warning Dialogs */}
      <MilestoneConfigDialog
        type="recurring"
        open={showRecurringConfig}
        onOpenChange={setShowRecurringConfig}
        onConfirm={handleConfirmRecurringMilestone}
        projectStartDate={projectStartDate}
        projectContinuous={projectContinuous}
        config={recurringConfig}
        onConfigChange={setRecurringConfig}
      />

      <MilestoneConfigDialog
        type="recurring-warning"
        open={showRecurringWarning}
        onOpenChange={setShowRecurringWarning}
        onConfirm={() => {
          handleDeleteRecurringMilestones();
          setShowRecurringConfig(true);
          setShowRecurringWarning(false);
        }}
        projectStartDate={projectStartDate}
        projectContinuous={projectContinuous}
      />

      <MilestoneConfigDialog
        type="split-warning"
        open={showSplitWarning}
        onOpenChange={setShowSplitWarning}
        onConfirm={handleDeleteAndSplit}
        projectStartDate={projectStartDate}
        projectContinuous={projectContinuous}
      />

      <MilestoneConfigDialog
        type="recurring-from-split-warning"
        open={showRecurringFromSplitWarning}
        onOpenChange={setShowRecurringFromSplitWarning}
        onConfirm={() => {
          handleDeleteAndSplit();
          setIsSplitMode(false);
          setShowRecurringConfig(true);
          setShowRecurringFromSplitWarning(false);
        }}
        projectStartDate={projectStartDate}
        projectContinuous={projectContinuous}
      />
    </div>
  );
}
