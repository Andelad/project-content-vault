// Layout constants used throughout the application
export const LAYOUT_CONSTANTS = {
  // Base spacing (21px system)
  BASE_SPACING: 21,
  HALF_SPACING: 10.5, // Not used in practice, but for reference
  QUARTER_SPACING: 5.25, // Not used in practice, but for reference
  
  // Common spacing values
  SPACING: {
    XXS: 3,
    XS: 6,
    SM: 12,
    MD: 21,  // Base spacing
    LG: 42,  // 2x base
    XL: 63,  // 3x base
    XXL: 84, // 4x base
  },
  
  // Component heights
  HEIGHTS: {
    HEADER: 60,
    SIDEBAR_HEADER: 60,
    TIMELINE_ROW: 52,
    TIMELINE_GROUP_HEADER: 32,
    TIMELINE_BASELINE: 8,
    BUTTON: 36,
    INPUT: 36,
    CARD_PADDING: 21,
  },
  
  // Sidebar
  SIDEBAR: {
    WIDTH_EXPANDED: 280,
    WIDTH_COLLAPSED: 60,
    ANIMATION_DURATION: 300,
  },
  
  // Timeline specific
  TIMELINE: {
    SIDEBAR_WIDTH_EXPANDED: 280,
    SIDEBAR_WIDTH_COLLAPSED: 60,
    DAY_COLUMN_WIDTH: 40,
    WEEK_COLUMN_WIDTH: 144,
    PROJECT_ROW_HEIGHT: 52,
    GROUP_HEADER_HEIGHT: 32,
    DATE_HEADER_HEIGHT: 48,
  },
  
  // Calendar specific
  CALENDAR: {
    WEEK_VIEW_HOUR_HEIGHT: 60,
    WEEK_VIEW_HEADER_HEIGHT: 80,
    MONTH_VIEW_CELL_HEIGHT: 120,
    EVENT_MIN_HEIGHT: 20,
  },
  
  // Z-index layers
  Z_INDEX: {
    BASE: 1,
    TIMELINE_CONTENT: 10,
    TIMELINE_BARS: 20,
    TIMELINE_BASELINE: 20,
    DRAG_HANDLES: 30,
    SCROLL_BUTTONS: 30,
    OVERLAYS: 40,
    MODALS: 50,
    TOOLTIPS: 100,
  },
  
  // Border radius (consistent with CSS variables)
  RADIUS: {
    SM: 'calc(var(--radius) - 4px)',
    MD: 'calc(var(--radius) - 2px)', 
    LG: 'var(--radius)',
    XL: 'calc(var(--radius) + 4px)',
    PILL: '9999px',
  },
  
  // Responsive breakpoints
  BREAKPOINTS: {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
    XXL: 1536,
  },
  
  // Animation durations
  ANIMATIONS: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
    VERY_SLOW: 1000,
  },
} as const;

// Helper function to get consistent spacing
export function getSpacing(multiplier: number = 1): number {
  return LAYOUT_CONSTANTS.BASE_SPACING * multiplier;
}

// Helper function to get responsive padding
export function getResponsivePadding(size: 'sm' | 'md' | 'lg' = 'md'): string {
  const spacing = {
    sm: LAYOUT_CONSTANTS.SPACING.SM,
    md: LAYOUT_CONSTANTS.SPACING.MD,
    lg: LAYOUT_CONSTANTS.SPACING.LG,
  };
  
  return `${spacing[size]}px`;
}