# Z-Index Stacking Fix Summary

## Problem
- Column markers were disappearing or appearing above project bars
- Project bars in some groups were hidden by stacking context issues
- Previous attempts created conflicting stacking contexts
- White background was covering column markers with negative z-index

## Root Cause
The timeline has a complex DOM structure with three key layers:
1. Column markers (absolute positioned at card level)
2. Main content container with white background
3. Timeline content area with project bars (flex sibling to sidebar)
4. Sidebar (should cover project bars that extend left)

The white background container was covering column markers when they had negative z-index.

## Solution
Set explicit z-index values to create a clear stacking hierarchy:

### Layer 1 (Bottom): Column Markers
- **Element**: `.timeline-card-container > [absolute column markers container]`
- **Z-Index**: `1`
- **Position**: Absolute
- **Purpose**: Background grid with weekend shading and today highlight
- **Location**: `TimelineView.tsx` line ~872

### Layer 2 (Middle): Main Content Container
- **Element**: `.flex.flex-col.min-h-full.bg-white` container
- **Z-Index**: `2`
- **Position**: Relative
- **Purpose**: White background container for sidebar and timeline
- **Location**: `TimelineView.tsx` line ~913

### Layer 3 (Project Content): Timeline Content Area
- **Element**: `.timeline-content-area`
- **Z-Index**: None (auto, inherits from parent z-index 2)
- **Position**: Relative
- **Purpose**: Contains all project rows and bars
- **Location**: `TimelineView.tsx` line ~1017

### Layer 1000 (Top): Sidebar
- **Element**: Sidebar content div
- **Z-Index**: `1000`
- **Position**: Relative (via className)
- **Purpose**: Covers project bars that extend into sidebar area
- **Location**: `TimelineView.tsx` line ~962

## Verification
✅ Column markers visible behind all project bars (zIndex: 1)
✅ Project bars visible in all groups (zIndex: 2 inherited from parent)
✅ Sidebar covers project bars when they extend left (zIndex: 1000)
✅ No overflow:hidden clipping content
✅ No conflicting stacking contexts

## Key Principles Applied
1. **Positive z-index for backgrounds**: Column markers at z-index: 1 ensures they're behind content but above card background
2. **Parent container z-index**: Main content at z-index: 2 creates stacking context for all content
3. **High z-index for overlay**: Sidebar at z-index: 1000 ensures it's always on top
4. **Avoid overflow:hidden**: Removed to prevent clipping absolutely positioned elements
5. **White background needs z-index**: Container with bg-white needs z-index to participate in stacking

## DOM Structure
```
Card (relative)
├── Column Markers Container (absolute, z-index: 1) ← BACKGROUND
└── Main Content Container (relative, z-index: 2, bg-white) ← MIDDLE
    ├── Sidebar (relative, z-index: 1000) ← TOP
    └── Timeline Content Area (relative, no z-index)
        └── Project Rows & Bars
```
