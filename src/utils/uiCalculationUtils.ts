// UI calculation utilities for dynamic styling and positioning

/**
 * Calculate dynamic width for input fields based on text content
 */
export const calculateDynamicWidth = (text: string, baseWidth: number = 80, charWidth: number = 8): number => {
  return Math.max(text.length * charWidth + 40, baseWidth);
};

/**
 * Calculate progress percentage with proper bounds checking
 */
export const calculateProgressPercentage = (completed: number, total: number): number => {
  if (total === 0) return 0;
  return Math.min(100, Math.max(0, (completed / total) * 100));
};

/**
 * Calculate safe position within bounds
 */
export const calculateSafePosition = (position: number, min: number = 0, max: number = 100): number => {
  return Math.min(max, Math.max(min, position));
};

/**
 * Calculate time slot index from position
 */
export const calculateTimeSlotIndex = (position: number, slotHeight: number): number => {
  return Math.max(0, Math.floor(position / slotHeight));
};

/**
 * Calculate hour from slot index
 */
export const calculateHourFromSlotIndex = (slotIndex: number, slotsPerHour: number = 4): number => {
  return Math.floor(slotIndex / slotsPerHour);
};

/**
 * Calculate minute from slot index
 */
export const calculateMinuteFromSlotIndex = (slotIndex: number, slotsPerHour: number = 4): number => {
  const slotInHour = slotIndex % slotsPerHour;
  return slotInHour * (60 / slotsPerHour);
};

/**
 * Calculate availability circle diameter based on hours and view mode
 * In weeks view, the hours required for full size circles is 5x the hours needed for day view
 */
