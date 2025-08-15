import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, User, Palette, X, Trash2, Info, Folder, Briefcase, Zap, Target, Lightbulb, Rocket, Star, Heart, Gift, Music, Camera, Code, Book, Gamepad2, Coffee, Home, Building, Car, Plane, Map, Globe } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { RichTextEditor } from './RichTextEditor';
import { useApp } from '../contexts/AppContext';
import { calculateProjectTimeMetrics } from '@/lib/projectCalculations';

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
  const { projects, groups, updateProject, addProject, deleteProject, creatingNewProject, setCurrentView, events, holidays, settings } = useApp();
  const project = (projectId && projectId !== '') ? projects.find(p => p.id === projectId) : null;
  const isCreating = (!projectId || projectId === '') && (groupId && groupId !== '');
  const group = groups.find(g => g.id === (project?.groupId || groupId));

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingProperty, setEditingProperty] = useState<string | null>(null);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Temporary state for style picker
  const [tempColor, setTempColor] = useState('');
  const [tempIcon, setTempIcon] = useState('');
  const [localValues, setLocalValues] = useState({
    name: '',
    client: '',
    estimatedHours: 40, // Default to 40 hours instead of 0
    notes: '',
    startDate: new Date(),
    endDate: new Date(),
    color: '',
    icon: 'folder'
  });

  // Store original values to restore on cancel
  const [originalValues, setOriginalValues] = useState({
    name: '',
    client: '',
    estimatedHours: 40, // Default to 40 hours instead of 0
    notes: '',
    startDate: new Date(),
    endDate: new Date(),
    color: '',
    icon: 'folder'
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
        icon: project.icon
      };
      
      setLocalValues(projectValues);
      setOriginalValues(projectValues);
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
        icon: 'folder'
      };
      
      setLocalValues(defaultValues);
      setOriginalValues(defaultValues);
    }
  }, [project, isCreating, creatingNewProject]);

  // Handle smooth modal closing - just call onClose, AnimatePresence will handle the animation
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle creating the new project
  const handleCreateProject = () => {
    if (isCreating && groupId && groupId !== '') {
      addProject({
        name: localValues.name.trim() || 'New Project', // Default to "New Project" if no name provided
        client: localValues.client.trim() || 'N/A', // Provide default if client is empty
        startDate: localValues.startDate,
        endDate: localValues.endDate,
        estimatedHours: localValues.estimatedHours,
        groupId,
        rowId: rowId || 'work-row-1', // Provide default rowId
        color: localValues.color || OKLCH_PROJECT_COLORS[0],
        notes: localValues.notes,
        icon: localValues.icon
      });
      handleClose();
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
      // Restore all original values to the actual project
      updateProject(projectId, originalValues);
      setLocalValues(originalValues);
    }
    handleClose();
  }, [isCreating, project, projectId, originalValues, updateProject, handleClose]);

  // Handle confirming changes
  const handleConfirm = useCallback(() => {
    if (isCreating) {
      handleCreateProject();
    } else {
      // For existing projects, changes are already saved via auto-save
      handleClose();
    }
  }, [isCreating, handleCreateProject, handleClose]);

  // Always render the AnimatePresence container, let it handle the conditional rendering
  if (!project && !isCreating && !isOpen) return null;

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

  const metrics = calculateProjectTimeMetrics(currentProject, events, holidays, settings);

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
    onActionClick = null
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
  }) => {
    const isEditing = editable && editingProperty === property;
    
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
                    <p className="text-sm">Go to Calendar</p>
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
            <span className="text-3xl font-bold text-foreground">{value}</span>
            <span className="text-lg text-muted-foreground">{unit}</span>
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
      // Validate date ranges for existing projects
      if (property === 'startDate' && localValues.endDate && value > localValues.endDate) {
        // If start date is after end date, adjust end date to match
        updateProject(projectId, { [property]: value, endDate: value });
        setLocalValues(prev => ({ ...prev, [property]: value, endDate: value }));
      } else if (property === 'endDate' && localValues.startDate && value < localValues.startDate) {
        // If end date is before start date, adjust start date to match
        updateProject(projectId, { [property]: value, startDate: value });
        setLocalValues(prev => ({ ...prev, [property]: value, startDate: value }));
      } else {
        updateProject(projectId, { [property]: value });
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
        updateProject(projectId, { name: newTitle.trim() });
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
      updateProject(projectId, { color: tempColor, icon: tempIcon });
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
    // Auto-save notes for existing projects only
    if (!isCreating && projectId && projectId !== '') {
      updateProject(projectId, { notes: value });
    }
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
    
    return (
      <div className="w-32">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full h-8 text-sm justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-3 w-3" />
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
                  setIsOpen(false);
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
    
    return (
      <div className="group relative">
        {isEditing ? (
          <Input
            type="text"
            defaultValue={value}
            placeholder={placeholder}
            className="w-32 h-8 text-sm border-border bg-background"
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
          <button
            className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded border border-transparent hover:border-border hover:bg-muted/50"
            onClick={() => setEditingProperty(property)}
          >
            {value || placeholder}
          </button>
        )}
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
    <AnimatePresence>
      {(isOpen && (project || isCreating)) && (
        <div key={modalKey}>
          {/* Backdrop */}
          <motion.div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          />
          
          {/* Modal */}
          <motion.div 
            className="fixed max-w-[1240px] w-[90vw] h-[95vh] bg-white rounded-lg overflow-hidden shadow-2xl z-50"
            style={{
              left: '50%',
              top: '2.5vh'
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-title"
            aria-describedby="project-description"
            initial={{ 
              opacity: 0, 
              x: '-50%',
              y: 20
            }}
            animate={{ 
              opacity: 1, 
              x: '-50%',
              y: 0
            }}
            exit={{ 
              opacity: 0, 
              x: '-50%',
              y: 20
            }}
            transition={{ 
              duration: 0.2, 
              ease: [0.16, 1, 0.3, 1],  // Custom easing for smooth feel
              opacity: { duration: 0.2 },
              y: { duration: 0.2 },
              x: { duration: 0 }  // No transition on x to maintain centering
            }}
          >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors z-10"
          aria-label="Close modal"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

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
        <div className="px-8 pt-6 pb-4 border-b border-gray-200 flex-shrink-0">
          {/* Group badge and Client */}
          <div className="flex items-center gap-3 mb-2">
            {group && (
              <Badge variant="secondary" className="text-xs">
                {group.name}
              </Badge>
            )}
            <HeaderClientField
              value={localValues.client}
              property="client"
              placeholder="Client"
            />
          </div>
          
          {/* Project Title and Dates */}
          <div className="flex items-center justify-between">
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
                    <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
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
            
            {/* Date Range */}
            <div className="flex items-center gap-2 text-sm">
              <HeaderDateField
                value={localValues.startDate}
                property="startDate"
              />
              <span className="text-muted-foreground">→</span>
              <HeaderDateField
                value={localValues.endDate}
                property="endDate"
              />
            </div>
          </div>
        </div>

        {/* Time Forecasting Dashboard */}
        <div className="border-b border-gray-200 bg-gray-50 px-8 py-6 flex-shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <TimeMetric
              label="Total Budgeted Time"
              value={localValues.estimatedHours}
              editable={true}
              property="estimatedHours"
            />
            
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
            />
            
            <TimeMetric
              label="Completed Time"
              value={metrics.completedTime}
              showInfo={true}
              tooltip="Completed time is time connected to this project that is ticked as done on your calendar"
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

        {/* Main Content - Column Layout */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Notes Panel */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="px-8 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-medium text-gray-900">Notes</h3>
            </div>
            
            <div className="flex-1 p-8 overflow-hidden">
              <RichTextEditor
                value={localValues.notes}
                onChange={handleNotesChange}
                placeholder="Add your project notes here...

You can format text using the toolbar above:
• Bold, italic, and underline text
• Create headings for organization
• Add bullet points and numbered lists
• Insert links and quotes
• Create code blocks

Start typing to capture all your project information in one place."
                className="h-full overflow-auto"
              />
            </div>
          </div>

          {/* Bottom Confirmation Row */}
          <div className="border-t border-gray-200 px-8 py-4 flex-shrink-0">
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}