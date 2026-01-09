import React from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { RichTextEditor } from '@/components/shadcn/rich-text-editor';

interface ProjectNotesSectionProps {
  projectId: string;
  notes: string;
  onNotesChange: (notes: string) => void;
  onSave?: () => void; // Optional save callback
}

export const ProjectNotesSection: React.FC<ProjectNotesSectionProps> = ({
  projectId,
  notes,
  onNotesChange,
  onSave,
}) => {
  return (
    <div className="p-6 h-full flex flex-col">
      {onSave && (
        <div className="flex items-center justify-end mb-4">
          <Button onClick={onSave} size="sm" className="gap-2">
            <Save className="w-4 h-4" />
            Save Notes
          </Button>
        </div>
      )}

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
