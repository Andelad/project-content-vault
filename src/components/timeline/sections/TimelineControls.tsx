import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';
import { Circle, Hash } from 'lucide-react';

interface TimelineControlsProps {
  availabilityDisplayMode: 'circles' | 'numbers';
  setAvailabilityDisplayMode: (mode: 'circles' | 'numbers') => void;
}

export function TimelineControls({
  availabilityDisplayMode,
  setAvailabilityDisplayMode
}: TimelineControlsProps) {
  return (
    <div className="mt-4 mb-4 flex justify-start">
      <ToggleGroup
        type="single"
        value={availabilityDisplayMode}
        onValueChange={(value) => {
          if (value) {
            setAvailabilityDisplayMode(value as 'circles' | 'numbers');
          }
        }}
        variant="outline"
        className="border border-gray-200 rounded-lg h-9 p-1"
      >
        <ToggleGroupItem value="circles" aria-label="Circles mode" className="px-2 py-1 h-7">
          <Circle className="w-4 h-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="numbers" aria-label="Numbers mode" className="px-2 py-1 h-7">
          <Hash className="w-4 h-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
