import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { useApp } from '../contexts/AppContext';
import { Milestone } from '@/types/core';

interface MilestoneManagerProps {
  projectId: string;
  projectEstimatedHours: number;
  onUpdateProjectBudget?: (newBudget: number) => void;
}

interface LocalMilestone extends Omit<Milestone, 'id'> {
  id?: string;
  isNew?: boolean;
}

export function MilestoneManager({ 
  projectId, 
  projectEstimatedHours, 
  onUpdateProjectBudget 
}: MilestoneManagerProps) {
  const { milestones, addMilestone, updateMilestone, deleteMilestone } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);
  const [localMilestones, setLocalMilestones] = useState<LocalMilestone[]>([]);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [suggestedBudget, setSuggestedBudget] = useState(0);

  // Get milestones for this project
  const projectMilestones = useMemo(() => {
    const existing = milestones.filter(m => m.projectId === projectId);
    const newMilestones = localMilestones.filter(m => 'isNew' in m && m.isNew);
    return [...existing, ...newMilestones] as (Milestone | LocalMilestone)[];
  }, [milestones, projectId, localMilestones]);

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
    const newMilestone: LocalMilestone = {
      name: '',
      dueDate: new Date(),
      timeAllocation: 8, // Default to 8 hours (1 day)
      projectId,
      order: projectMilestones.length,
      isNew: true
    };
    setLocalMilestones(prev => [...prev, newMilestone]);
  };

  const updateLocalMilestone = (index: number, updates: Partial<LocalMilestone>) => {
    setLocalMilestones(prev => prev.map((milestone, i) => 
      i === index ? { ...milestone, ...updates } : milestone
    ));
  };

  const saveNewMilestone = async (index: number) => {
    const milestone = localMilestones[index];
    if (!milestone || !milestone.name.trim()) return;

    // Check if total allocation exceeds project budget
    const newTotal = totalTimeAllocation;
    if (newTotal > projectEstimatedHours) {
      setSuggestedBudget(suggestedBudgetFromMilestones);
      setShowBudgetDialog(true);
      return;
    }

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
    }
  };

  const deleteLocalMilestone = (index: number) => {
    setLocalMilestones(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    try {
      await deleteMilestone(milestoneId);
    } catch (error) {
      console.error('Failed to delete milestone:', error);
    }
  };

  const handleUpdateMilestone = async (milestoneId: string, updates: Partial<Milestone>) => {
    try {
      await updateMilestone(milestoneId, updates);
    } catch (error) {
      console.error('Failed to update milestone:', error);
    }
  };

  const handleConfirmBudgetUpdate = () => {
    if (onUpdateProjectBudget) {
      onUpdateProjectBudget(suggestedBudget);
    }
    setShowBudgetDialog(false);
    
    // Now save the milestone
    const pendingMilestone = localMilestones.find(m => m.isNew);
    if (pendingMilestone) {
      const index = localMilestones.findIndex(m => m.isNew);
      saveNewMilestone(index);
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

              {/* Existing Milestones */}
              {projectMilestones.filter(m => !('isNew' in m) || !m.isNew).map((milestone) => (
                <MilestoneRow
                  key={milestone.id}
                  milestone={milestone as Milestone}
                  projectEstimatedHours={projectEstimatedHours}
                  onUpdate={handleUpdateMilestone}
                  onDelete={handleDeleteMilestone}
                />
              ))}

              {/* New Milestones */}
              {localMilestones.map((milestone, index) => (
                ('isNew' in milestone && milestone.isNew) && (
                  <NewMilestoneRow
                    key={index}
                    milestone={milestone}
                    projectEstimatedHours={projectEstimatedHours}
                    onUpdate={(updates) => updateLocalMilestone(index, updates)}
                    onSave={() => saveNewMilestone(index)}
                    onCancel={() => deleteLocalMilestone(index)}
                  />
                )
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

      {/* Budget Update Dialog */}
      <AlertDialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Project Budget?</AlertDialogTitle>
            <AlertDialogDescription>
              The milestones you've added require more time than currently budgeted. 
              Would you like to update the project budget from {projectEstimatedHours}h to {suggestedBudget}h?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowBudgetDialog(false)}>
              Keep Current Budget
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBudgetUpdate}>
              Update Budget to {suggestedBudget}h
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Component for existing milestone rows
function MilestoneRow({ 
  milestone, 
  projectEstimatedHours, 
  onUpdate, 
  onDelete 
}: {
  milestone: Milestone;
  projectEstimatedHours: number;
  onUpdate: (id: string, updates: Partial<Milestone>) => void;
  onDelete: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    name: milestone.name,
    timeAllocation: milestone.timeAllocation,
    dueDate: milestone.dueDate
  });

  const handleSave = () => {
    onUpdate(milestone.id!, editValues);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValues({
      name: milestone.name,
      timeAllocation: milestone.timeAllocation,
      dueDate: milestone.dueDate
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={editValues.name}
              onChange={(e) => setEditValues(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Milestone name"
            />
          </div>
          
          <div>
            <Label htmlFor="allocation">Hours Allocated</Label>
            <Input
              id="allocation"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={editValues.timeAllocation}
              onChange={(e) => setEditValues(prev => ({ ...prev, timeAllocation: parseFloat(e.target.value) || 0 }))}
            />
          </div>

          <div>
            <Label htmlFor="dueDate">Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  {editValues.dueDate.toLocaleDateString()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={editValues.dueDate}
                  onSelect={(date) => date && setEditValues(prev => ({ ...prev, dueDate: date }))}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button size="sm" onClick={handleSave}>Save</Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{milestone.name}</h4>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            <span>Due: {milestone.dueDate.toLocaleDateString()}</span>
            <span>{milestone.timeAllocation}h</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setIsEditing(true)}
          >
            Edit
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => onDelete(milestone.id!)}
            className="text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Component for new milestone creation
function NewMilestoneRow({ 
  milestone, 
  projectEstimatedHours, 
  onUpdate, 
  onSave, 
  onCancel 
}: {
  milestone: LocalMilestone;
  projectEstimatedHours: number;
  onUpdate: (updates: Partial<LocalMilestone>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border border-blue-200 rounded-lg p-4 mb-3 bg-blue-50">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="newName">Name</Label>
          <Input
            id="newName"
            value={milestone.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Milestone name"
          />
        </div>
        
        <div>
          <Label htmlFor="newAllocation">Hours Allocated</Label>
          <Input
            id="newAllocation"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={milestone.timeAllocation}
            onChange={(e) => onUpdate({ timeAllocation: parseFloat(e.target.value) || 0 })}
          />
        </div>

        <div>
          <Label htmlFor="newDueDate">Due Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                {milestone.dueDate.toLocaleDateString()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={milestone.dueDate}
                onSelect={(date) => date && onUpdate({ dueDate: date })}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button 
          size="sm" 
          onClick={onSave}
          disabled={!milestone.name.trim()}
        >
          Add Milestone
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
