import React from 'react';
import { Button } from '../ui/button';
import { GraduationCap } from 'lucide-react';

interface HelpButtonProps {
  onClick: () => void;
}

export function HelpButton({ onClick }: HelpButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="h-9 w-9 p-0 rounded-full bg-stone-100"
      aria-label="Help"
    >
      <GraduationCap className="w-4 h-4" />
    </Button>
  );
}
