import React from 'react';
import { Save } from 'lucide-react';
import { Button } from '../../ui/button';
import { RichTextEditor } from '../../ui/rich-text-editor';

interface ProjectNotesSectionProps {
  projectId: string;
  notes: string;
  onNotesChange: (notes: string) => void;
  onSave: () => void;
}

export const ProjectNotesSection: React.FC<ProjectNotesSectionProps> = ({
  projectId,
  notes,
  onNotesChange,
  onSave,
}) => {
  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Project Notes</h3>
        <Button onClick={onSave} size="sm" className="gap-2">
          <Save className="w-4 h-4" />
          Save Notes
        </Button>
      </div>

      <div className="flex-1 min-h-0">
        <RichTextEditor
          value={notes}
          onChange={onNotesChange}
          placeholder="Add notes about this project..."
          className="h-full"
        />
      </div>
    </div>
  );
};
