import React, { memo, useState, useEffect } from 'react';
import { Trash2, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useProjectContext } from '@/contexts/ProjectContext';
interface DeleteRowModalProps {
  row: any;
  projectCount: number;
  onClose: () => void;
  onConfirm: () => void;
}
function DeleteRowModal({ row, projectCount, onClose, onConfirm }: DeleteRowModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteRow } = useProjectContext();
  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await deleteRow(row.id);
      onConfirm();
      onClose();
    } catch (error) {
      console.error('Error deleting row:', error);
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600">Delete Row: {row.name}</DialogTitle>
          <DialogDescription className="space-y-3">
            <div className="text-sm">
              ⚠️ <strong>WARNING:</strong> This action cannot be undone.
            </div>
            <div className="text-sm">
              Deleting this row will permanently delete:
            </div>
            <ul className="text-sm list-disc list-inside ml-4 space-y-1">
              <li>The row itself</li>
              <li><strong>{projectCount} project{projectCount !== 1 ? 's' : ''}</strong> currently in this row</li>
              <li>All milestones for those projects</li>
              <li>Calendar events will lose their project association</li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">
              Type <span className="font-mono bg-gray-100 px-1 rounded">DELETE</span> to confirm:
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE here"
              className="mt-2"
            />
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={confirmText !== 'DELETE' || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Row'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
interface DraggableRowComponentProps {
  row: any;
  index: number;
  groupId: string;
}
export const DraggableRowComponent = memo(function DraggableRowComponent({
  row,
  index,
  groupId
}: DraggableRowComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(row.name);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { updateRow, projects } = useProjectContext();
  // Update editValue when row.name changes from external updates
  useEffect(() => {
    setEditValue(row.name);
  }, [row.name]);
  // Count projects in this row
  const projectsInRow = projects.filter(project => project.rowId === row.id);
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(row.name);
  };
  const handleSaveEdit = async () => {
    if (editValue.trim() !== row.name && editValue.trim()) {
      try {
        await updateRow(row.id, { name: editValue.trim() });
      } catch (error) {
        console.error('Row update failed:', error);
        // Reset to original value on error
        setEditValue(row.name);
      }
    }
    setIsEditing(false);
  };
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue(row.name);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };
  return (
    <>
      <div className="flex items-center h-[52px] px-6 py-0 bg-white hover:bg-gray-50 transition-colors duration-200 group cursor-pointer">
        {/* Row Name */}
        <div className="flex items-center flex-1 min-w-0">
          {isEditing ? (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveEdit}
              className="h-9 text-sm border-input bg-background focus:border-primary"
              autoFocus
            />
          ) : (
            <span 
              className="text-sm text-gray-700 truncate cursor-pointer hover:text-gray-600 transition-colors"
              onClick={handleEditClick}
            >
              {row.name}
            </span>
          )}
        </div>
        {/* Actions (shown on hover) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 ml-2">
          {isEditing ? (
            <>
              <button
                className="p-1 rounded hover:bg-gray-200 transition-colors duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveEdit();
                }}
              >
                <Check className="w-3 h-3 text-gray-500" />
              </button>
              <button
                className="p-1 rounded hover:bg-gray-200 transition-colors duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelEdit();
                }}
              >
                <X className="w-3 h-3 text-gray-500" />
              </button>
            </>
          ) : (
            <button
              className="p-1 rounded hover:bg-gray-200 transition-colors duration-200"
              onClick={handleDeleteClick}
            >
              <Trash2 className="w-3 h-3 text-gray-500" />
            </button>
          )}
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteRowModal
          row={row}
          projectCount={projectsInRow.length}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
});