import React, { createContext, useContext } from 'react';
import { Milestone } from '@/types/core';
import { useMilestones as useMilestonesHook } from '@/hooks/useMilestones';

interface MilestoneContextType {
  // Milestones
  milestones: any[];
  addMilestone: (milestone: any) => void;
  updateMilestone: (id: string, updates: any) => void;
  deleteMilestone: (id: string) => void;
  reorderMilestones: (projectId: string, fromIndex: number, toIndex: number) => void;
  
  // Loading states
  isLoading: boolean;
}

const MilestoneContext = createContext<MilestoneContextType | undefined>(undefined);

export function MilestoneProvider({ children }: { children: React.ReactNode }) {
  // Database hooks
  const { 
    milestones: dbMilestones, 
    loading: milestonesLoading, 
    addMilestone: dbAddMilestone, 
    updateMilestone: dbUpdateMilestone, 
    deleteMilestone: dbDeleteMilestone, 
    reorderMilestones: dbReorderMilestones 
  } = useMilestonesHook();

  const contextValue: MilestoneContextType = {
    // Milestones
    milestones: dbMilestones || [],
    addMilestone: dbAddMilestone,
    updateMilestone: dbUpdateMilestone,
    deleteMilestone: dbDeleteMilestone,
    reorderMilestones: dbReorderMilestones,
    
    // Loading states
    isLoading: milestonesLoading,
  };

  return (
    <MilestoneContext.Provider value={contextValue}>
      {children}
    </MilestoneContext.Provider>
  );
}

export function useMilestoneContext() {
  const context = useContext(MilestoneContext);
  if (context === undefined) {
    throw new Error('useMilestoneContext must be used within a MilestoneProvider');
  }
  return context;
}

// Export types
export type { Milestone } from '@/types/core';
