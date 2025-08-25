// Alternative implementations for MilestoneDateField with different visual indicators

// OPTION 1: Fade out approach (most subtle)
const MilestoneDateFieldFaded = ({ milestone, property = 'dueDate' }) => {
  // ... same setup code ...

  return (
    <div className="min-w-[120px]">
      <Label className="text-xs text-muted-foreground mb-1 block">Due Date</Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10 text-sm justify-start text-left font-normal px-3 w-full">
            <CalendarIcon className="mr-2 h-3 w-3" />
            {formatDate(milestone.dueDate)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={milestone.dueDate}
            onSelect={(selectedDate) => {
              if (selectedDate && selectedDate >= minDate && selectedDate <= maxDate) {
                handleSaveMilestoneProperty(milestone.id!, property, selectedDate);
                setIsOpen(false);
              }
            }}
            disabled={(date) => date < minDate || date > maxDate}
            modifiersStyles={{
              disabled: { 
                opacity: 0.3,
                backgroundColor: '#f3f4f6',
                textDecoration: 'line-through',
                color: '#9ca3af'
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

// OPTION 2: Color-coded ranges
const MilestoneDateFieldColorCoded = ({ milestone, property = 'dueDate' }) => {
  // ... same setup code ...

  return (
    <div className="min-w-[140px]">
      <Label className="text-xs text-muted-foreground mb-1 block">Due Date</Label>
      
      {/* Color legend */}
      <div className="text-xs mb-2 space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-200 border border-green-400 rounded"></div>
          <span className="text-gray-600">Available dates</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-200 border border-red-400 rounded"></div>
          <span className="text-gray-600">Other milestones</span>
        </div>
      </div>
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10 text-sm justify-start text-left font-normal px-3 w-full">
            <CalendarIcon className="mr-2 h-3 w-3" />
            {formatDate(milestone.dueDate)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={milestone.dueDate}
            onSelect={(selectedDate) => {
              if (selectedDate) {
                handleSaveMilestoneProperty(milestone.id!, property, selectedDate);
                setIsOpen(false);
              }
            }}
            disabled={(date) => date < minDate || date > maxDate}
            modifiers={{
              validRange: (date) => date >= minDate && date <= maxDate,
              otherMilestone: (date) => projectMilestones
                .filter(m => m.id !== milestone.id)
                .some(m => m.dueDate.toDateString() === date.toDateString())
            }}
            modifiersStyles={{
              validRange: { 
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)'
              },
              otherMilestone: {
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                textDecoration: 'line-through'
              },
              disabled: {
                opacity: 0.4,
                backgroundColor: '#f9fafb',
                textDecoration: 'line-through'
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

// OPTION 3: Timeline visual above calendar
const MilestoneDateFieldWithTimeline = ({ milestone, property = 'dueDate' }) => {
  // ... same setup code ...

  return (
    <div className="min-w-[160px]">
      <Label className="text-xs text-muted-foreground mb-1 block">Due Date</Label>
      
      {/* Project timeline visualization */}
      <div className="mb-3 p-2 bg-gray-50 rounded border">
        <div className="text-xs text-gray-600 mb-2">Project Timeline</div>
        <div className="relative h-6 bg-gray-200 rounded">
          {/* Project duration bar */}
          <div className="absolute inset-0 bg-blue-200 rounded"></div>
          
          {/* Valid range for this milestone */}
          <div 
            className="absolute top-0 bottom-0 bg-green-300 rounded"
            style={{
              left: `${((minDate.getTime() - projectStartDate.getTime()) / (projectEndDate.getTime() - projectStartDate.getTime())) * 100}%`,
              width: `${((maxDate.getTime() - minDate.getTime()) / (projectEndDate.getTime() - projectStartDate.getTime())) * 100}%`
            }}
          ></div>
          
          {/* Other milestone markers */}
          {projectMilestones
            .filter(m => m.id !== milestone.id)
            .map((m, index) => (
              <div
                key={`${m.id}-${index}`}
                className="absolute top-0 bottom-0 w-1 bg-red-500"
                style={{
                  left: `${((m.dueDate.getTime() - projectStartDate.getTime()) / (projectEndDate.getTime() - projectStartDate.getTime())) * 100}%`
                }}
              />
            ))
          }
          
          {/* Current milestone marker */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-blue-600"
            style={{
              left: `${((milestone.dueDate.getTime() - projectStartDate.getTime()) / (projectEndDate.getTime() - projectStartDate.getTime())) * 100}%`
            }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{formatDate(projectStartDate)}</span>
          <span>{formatDate(projectEndDate)}</span>
        </div>
      </div>
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10 text-sm justify-start text-left font-normal px-3 w-full">
            <CalendarIcon className="mr-2 h-3 w-3" />
            {formatDate(milestone.dueDate)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={milestone.dueDate}
            onSelect={(selectedDate) => {
              if (selectedDate) {
                handleSaveMilestoneProperty(milestone.id!, property, selectedDate);
                setIsOpen(false);
              }
            }}
            disabled={(date) => date < minDate || date > maxDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
