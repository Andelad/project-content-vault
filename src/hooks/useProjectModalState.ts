import React, { useState, useCallback } from 'react';
import { useProjectContext } from '../contexts/ProjectContext';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useHolidays } from '../hooks/useHolidays';
import { calculateProjectTimeMetrics } from '@/services/projects';
import { OKLCH_PROJECT_COLORS } from '../constants/projectModalConstants';

interface UseProjectModalStateProps {
  projectId?: string;
  groupId?: string;
  rowId?: string;
  creatingNewProject?: any;
}

export function useProjectModalState({
  projectId,
  groupId,
  rowId,
  creatingNewProject,
}: UseProjectModalStateProps) {
  const {
    projects,
    groups,
    updateProject,
    milestones,
    addMilestone,
  } = useProjectContext();

  const { settings } = useSettingsContext();
  const { holidays: rawHolidays } = useHolidays();

  // Transform holidays to match expected format
  const holidays = rawHolidays.map(holiday => ({
    id: holiday.id,
    title: holiday.title,
    startDate: new Date(holiday.start_date),
    endDate: new Date(holiday.end_date),
    notes: holiday.notes
  }));

  // Find the project if editing existing
  const project = projectId ? projects.find(p => p.id === projectId) : undefined;

  // Resolve group and row IDs
  const resolvedGroupId = creatingNewProject?.groupId ?? groupId;
  const resolvedRowId = creatingNewProject?.rowId ?? rowId;

  // Determine if we're creating a new project
  const isCreating = (!projectId || projectId === '') && !!resolvedGroupId;

  // State management
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingProperty, setEditingProperty] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Section expansion states
  const [isInsightsExpanded, setIsInsightsExpanded] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(true);

  // Temporary state for style picker
  const [tempColor, setTempColor] = useState('');
  const [tempIcon, setTempIcon] = useState('');

  // Milestone state for new projects
  const [localProjectMilestones, setLocalProjectMilestones] = useState<Array<{
    name: string;
    dueDate: Date;
    timeAllocation: number;
    projectId: string;
    order: number;
    isNew?: boolean;
  }>>([]);

  // Recurring milestone tracking
  const [recurringMilestoneInfo, setRecurringMilestoneInfo] = useState<{
    totalAllocation: number;
    hasRecurring: boolean;
  }>({ totalAllocation: 0, hasRecurring: false });

  // Local values state
  const [localValues, setLocalValues] = useState({
    name: '',
    client: '',
    estimatedHours: 40,
    notes: '',
    startDate: new Date(),
    endDate: new Date(),
    color: '',
    icon: 'folder',
    continuous: false
  });

  // Store original values for cancel
  const [originalValues, setOriginalValues] = useState({
    name: '',
    client: '',
    estimatedHours: 40,
    notes: '',
    startDate: new Date(),
    endDate: new Date(),
    color: '',
    icon: 'folder',
    continuous: false
  });

  // Initialize state when project changes
  React.useEffect(() => {
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
        continuous: project.continuous ?? false
      };

      setLocalValues(projectValues);
      setOriginalValues(projectValues);
      setLocalProjectMilestones([]);
    } else if (isCreating) {
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
      setLocalProjectMilestones([]);
    }
  }, [project, isCreating, creatingNewProject]);

  // Handlers
  const handleTitleSave = useCallback((newTitle: string) => {
    if (newTitle.trim()) {
      if (isCreating) {
        setLocalValues(prev => ({ ...prev, name: newTitle.trim() }));
      } else if (projectId && projectId !== '') {
        updateProject(projectId, { name: newTitle.trim() }, { silent: true });
        setLocalValues(prev => ({ ...prev, name: newTitle.trim() }));
      }
    }
    setEditingTitle(false);
  }, [isCreating, projectId, updateProject]);

  const handleSaveProperty = useCallback((property: string, value: any) => {
    // Validate date values
    if ((property === 'startDate' || property === 'endDate') && value instanceof Date) {
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
      // Validate date ranges for existing projects
      if (property === 'startDate' && localValues.endDate && value > localValues.endDate) {
        updateProject(projectId, { [property]: value, endDate: value }, { silent: true });
        setLocalValues(prev => ({ ...prev, [property]: value, endDate: value }));
      } else if (property === 'endDate' && localValues.startDate && value < localValues.startDate) {
        updateProject(projectId, { [property]: value, startDate: value }, { silent: true });
        setLocalValues(prev => ({ ...prev, [property]: value, startDate: value }));
      } else {
        updateProject(projectId, { [property]: value }, { silent: true });
        setLocalValues(prev => ({ ...prev, [property]: value }));
      }
    }
    setEditingProperty(null);
  }, [isCreating, projectId, localValues, updateProject]);

  const handleColorChange = useCallback((color: string) => {
    setTempColor(color);
  }, []);

  const handleIconChange = useCallback((icon: string) => {
    setTempIcon(icon);
  }, []);

  const handleStyleSave = useCallback(() => {
    if (isCreating) {
      setLocalValues(prev => ({ ...prev, color: tempColor, icon: tempIcon }));
    } else if (projectId && projectId !== '') {
      updateProject(projectId, { color: tempColor, icon: tempIcon }, { silent: true });
    }
    // Reset temp values
    setTempColor('');
    setTempIcon('');
  }, [isCreating, projectId, tempColor, tempIcon, updateProject]);

  const handleStyleCancel = useCallback(() => {
    setTempColor('');
    setTempIcon('');
  }, []);

  const handleNotesChange = useCallback((value: string) => {
    setLocalValues(prev => ({ ...prev, notes: value }));
    // Auto-save notes for existing projects only
    if (!isCreating && projectId && projectId !== '') {
      updateProject(projectId, { notes: value }, { silent: true });
    }
  }, [isCreating, projectId, updateProject]);

  const handleContinuousToggle = useCallback(() => {
    const newContinuous = !localValues.continuous;
    setLocalValues(prev => ({ ...prev, continuous: newContinuous }));

    // Auto-save for existing projects
    if (!isCreating && projectId && projectId !== '') {
      updateProject(projectId, { continuous: newContinuous }, { silent: true });
    }
  }, [isCreating, projectId, localValues.continuous, updateProject]);

  const handleGroupChange = useCallback((newGroupId: string) => {
    if (!isCreating && projectId && projectId !== '') {
      updateProject(projectId, { groupId: newGroupId }, { silent: true });
    }
  }, [isCreating, projectId, updateProject]);

  // Calculate project metrics
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

    const metrics = calculateProjectTimeMetrics(currentProject, [], holidays, settings);

  return {
    // State
    project,
    isCreating,
    resolvedGroupId,
    resolvedRowId,
    group: groups.find(g => g.id === (project?.groupId || resolvedGroupId || groupId)),

    // UI State
    editingTitle,
    editingProperty,
    showDeleteConfirm,
    isInsightsExpanded,
    isNotesExpanded,
    tempColor,
    tempIcon,
    localProjectMilestones,
    recurringMilestoneInfo,
    localValues,
    originalValues,

    // Computed
    metrics,

    // Handlers
    setEditingTitle,
    setEditingProperty,
    setShowDeleteConfirm,
    setIsInsightsExpanded,
    setIsNotesExpanded,
    setTempColor,
    setTempIcon,
    setLocalProjectMilestones,
    setRecurringMilestoneInfo,

    handleTitleSave,
    handleSaveProperty,
    handleColorChange,
    handleIconChange,
    handleStyleSave,
    handleStyleCancel,
    handleNotesChange,
    handleContinuousToggle,
    handleGroupChange,
  };
}
