import { useState, useCallback } from 'react';
import { useProjectContext } from '../contexts/ProjectContext';

interface UseProjectDetailModalStateProps {
  projectId: string;
  project: any;
  onClose: () => void;
}

export function useProjectDetailModalState({
  projectId,
  project,
  onClose,
}: UseProjectDetailModalStateProps) {
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
      console.error('Failed to save notes:', error);
    }
  }, [projectId, notes, updateProject, project]);

  // Handle deleting project
  const handleDeleteProject = useCallback(async () => {
    try {
      await deleteProject(projectId);
      onClose();
    } catch (error) {
      console.error('Failed to delete project:', error);
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
