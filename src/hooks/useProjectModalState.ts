import { useState, useCallback } from 'react';
import { useProjectContext } from '../contexts/ProjectContext';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

interface UseProjectModalStateProps {
  projectId: string;
  project: any;
  onClose: () => void;
}

export function useProjectModalState({
  projectId,
  project,
  onClose,
}: UseProjectModalStateProps) {
  const { deleteProject, updateProject } = useProjectContext();

  // Modal state
  const [activeSection, setActiveSection] = useState('insights');
  const [notes, setNotes] = useState(project?.notes || '');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Handle saving notes
  const handleSaveNotes = useCallback(async () => {
    if (!project) return;

    try {
      await updateProject(projectId, { notes });
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useProjectModalState', action: 'Failed to save notes:' });
    }
  }, [projectId, notes, updateProject, project]);

  // Handle deleting project
  const handleDeleteProject = useCallback(async () => {
    try {
      await deleteProject(projectId);
      onClose();
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useProjectModalState', action: 'Failed to delete project:' });
    }
  }, [projectId, deleteProject, onClose]);

  return {
    activeSection,
    setActiveSection,
    notes,
    setNotes,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    handleSaveNotes,
    handleDeleteProject,
  };
}
