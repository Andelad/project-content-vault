import React from 'react';
import { Button } from '../ui/button';
import { Settings } from 'lucide-react';

interface AvailabilityCardSettingsButtonProps {
  onClick: () => void;
}

export function AvailabilityCardSettingsButton({ onClick }: AvailabilityCardSettingsButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="h-8 w-8 p-0 rounded-full bg-stone-100"
      aria-label="Availability card settings"
    >
      <Settings className="w-4 h-4" />
    </Button>
  );
}
