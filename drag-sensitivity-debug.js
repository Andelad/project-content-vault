console.log(`
🔍 DRAG SENSITIVITY DEBUG ANALYSIS
==================================

POSSIBLE CAUSES OF "OVER-RESPONSIVE" DRAG:

1. VIEWPORT SCALING ISSUE:
   - Browser zoom level affecting clientX calculations
   - CSS transforms scaling coordinates
   - devicePixelRatio differences

2. INCORRECT DAY WIDTH CALCULATION:
   - dragUtils.ts uses: mode === 'weeks' ? 11px per day
   - timelinePositioning.ts uses: different calculation?
   - Mismatch = amplified movement

3. COORDINATE SYSTEM CONFUSION:
   - Mouse coordinates in viewport space
   - Timeline coordinates in timeline space  
   - Offset calculation error

4. ACCUMULATION ERROR:
   - dragState.daysDelta being accumulated incorrectly
   - Previous drag offset not being reset

🧪 DEBUG STEPS TO IDENTIFY ISSUE:

1. Test mouse movement vs pixel movement:
   - Move mouse 77px right in weeks view
   - Should move exactly 7 days (1 week)
   - If moves more: sensitivity too high

2. Check console logs during drag:
   - Log deltaX (currentX - startX) 
   - Log calculated daysDelta
   - Log applied dragOffsetPx
   - Compare ratios

3. Verify day width consistency:
   - dragUtils.ts: 11px per day in weeks
   - timelinePositioning.ts: should also be 11px per day
   - Any mismatch = amplification

LIKELY SOLUTION:

If it's "thrown" further than mouse movement, probably:
- dayWidth calculation inconsistency
- Browser zoom affecting calculations
- Coordinate system offset

Need to add debug logging to see actual values during drag.
`);
