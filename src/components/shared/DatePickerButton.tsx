import React from 'react';
import { Button } from '../shadcn/button';
import { Popover, PopoverContent, PopoverTrigger } from '../shadcn/popover';
import { Calendar } from '../shadcn/calendar';
import { CalendarSearch } from 'lucide-react';

interface DatePickerButtonProps {
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function DatePickerButton({
  selected,
  onSelect,
  isOpen,
  onOpenChange,
  align = 'start',
  className
}: DatePickerButtonProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className={className || "h-9 w-9"}>
          <CalendarSearch className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={onSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
