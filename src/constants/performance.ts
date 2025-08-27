// Performance limits and constants
export const PERFORMANCE_LIMITS = {
  MAX_PROJECTS_PER_GROUP: 50,
  MAX_GROUPS: 20,
  MAX_EVENTS: 1000,
  MAX_HOLIDAYS: 100,
  
  // Timeline specific limits
  MAX_VIEWPORT_DAYS: 365,
  MIN_VIEWPORT_DAYS: 7,
  
  // Rendering limits
  MAX_CONCURRENT_ANIMATIONS: 3,
  DEBOUNCE_DELAY: 100,
  THROTTLE_DELAY: 16, // ~60fps
  
  // Memory limits
  MAX_CACHED_CALCULATIONS: 100,
  MAX_UNDO_HISTORY: 50,
} as const;

export const TIMELINE_CONSTANTS = {
  // Animation timing
  SCROLL_ANIMATION_DURATION: 300,
  SCROLL_ANIMATION_MAX_DURATION: 1000,
  SCROLL_ANIMATION_MS_PER_DAY: 10,
  
  // Auto-scroll
  AUTO_SCROLL_THRESHOLD: 80, // pixels from edge
  AUTO_SCROLL_INTERVAL: 150, // ms
  AUTO_SCROLL_AMOUNT_DAYS: 3,
  AUTO_SCROLL_AMOUNT_WEEKS: 7,
  
  // Drag sensitivity
  DRAG_THRESHOLD: 5, // pixels before drag starts
  
  // Visual constants
  DAY_WIDTH: 40, // pixels
  DAY_GAP: 1, // pixels
  WEEK_WIDTH: 72, // pixels
  ROW_HEIGHT: 52, // pixels
  GROUP_HEADER_HEIGHT: 32, // pixels
} as const;

export const CALENDAR_CONSTANTS = {
  HOUR_HEIGHT: 60, // pixels per hour in day view
  MIN_EVENT_DURATION: 15, // minutes
  SNAP_TO_GRID: 15, // minutes
  
  // Week view
  WEEK_HEADER_HEIGHT: 80,
  WEEK_DAY_WIDTH: 200,
  
  // Month view  
  MONTH_DAY_HEIGHT: 120,
  MONTH_CELL_WIDTH: 200,
} as const;