/**
 * Project Color Normalization Tests
 * 
 * Tests for automatic color migration from old palettes to new uniform palette
 * 
 * @see src/utils/normalizeProjectColor.ts
 */

import { describe, it, expect } from 'vitest';
import { normalizeProjectColor, needsColorNormalization } from '../normalizeProjectColor';

describe('normalizeProjectColor', () => {
  
  describe('New palette colors (0.76 lightness)', () => {
    it('should keep valid new colors unchanged', () => {
      const newColors = [
        'oklch(0.76 0.15 0)',
        'oklch(0.76 0.15 30)',
        'oklch(0.76 0.15 60)',
        'oklch(0.76 0.15 90)',
        'oklch(0.76 0.15 120)',
        'oklch(0.76 0.15 150)',
        'oklch(0.76 0.15 180)',
        'oklch(0.76 0.15 210)',
        'oklch(0.76 0.15 240)',
        'oklch(0.76 0.15 270)',
        'oklch(0.76 0.15 300)',
        'oklch(0.76 0.15 330)',
      ];
      
      newColors.forEach(color => {
        expect(normalizeProjectColor(color)).toBe(color);
      });
    });
  });
  
  describe('Old 0.72 lightness colors', () => {
    it('should migrate 0.72 red to 0.76 red', () => {
      expect(normalizeProjectColor('oklch(0.72 0.15 0)')).toBe('oklch(0.76 0.15 0)');
    });
    
    it('should migrate 0.72 orange to 0.76 orange', () => {
      expect(normalizeProjectColor('oklch(0.72 0.15 30)')).toBe('oklch(0.76 0.15 30)');
    });
    
    it('should migrate 0.72 yellow to 0.76 yellow', () => {
      expect(normalizeProjectColor('oklch(0.72 0.15 60)')).toBe('oklch(0.76 0.15 60)');
    });
    
    it('should migrate 0.72 lime to 0.76 lime', () => {
      expect(normalizeProjectColor('oklch(0.72 0.15 90)')).toBe('oklch(0.76 0.15 90)');
    });
    
    it('should migrate 0.72 green to 0.76 green', () => {
      expect(normalizeProjectColor('oklch(0.72 0.15 120)')).toBe('oklch(0.76 0.15 120)');
    });
    
    it('should migrate all 12 0.72 colors correctly', () => {
      const oldColors = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
      
      oldColors.forEach(hue => {
        const oldColor = `oklch(0.72 0.15 ${hue})`;
        const expectedNew = `oklch(0.76 0.15 ${hue})`;
        expect(normalizeProjectColor(oldColor)).toBe(expectedNew);
      });
    });
  });
  
  describe('Old 0.65 lightness colors', () => {
    it('should migrate 0.65 red variations to 0.76 red', () => {
      expect(normalizeProjectColor('oklch(0.65 0.15 0)')).toBe('oklch(0.76 0.15 0)');
      expect(normalizeProjectColor('oklch(0.65 0.15 15)')).toBe('oklch(0.76 0.15 0)');
    });
    
    it('should migrate 0.65 orange variations to 0.76 orange', () => {
      expect(normalizeProjectColor('oklch(0.65 0.15 25)')).toBe('oklch(0.76 0.15 30)');
      expect(normalizeProjectColor('oklch(0.65 0.15 30)')).toBe('oklch(0.76 0.15 30)');
      expect(normalizeProjectColor('oklch(0.65 0.15 45)')).toBe('oklch(0.76 0.15 30)');
    });
    
    it('should migrate 0.65 yellow variations to 0.76 yellow', () => {
      expect(normalizeProjectColor('oklch(0.65 0.15 60)')).toBe('oklch(0.76 0.15 60)');
      expect(normalizeProjectColor('oklch(0.65 0.15 65)')).toBe('oklch(0.76 0.15 60)');
    });
    
    it('should migrate 0.65 lime variations to 0.76 lime', () => {
      expect(normalizeProjectColor('oklch(0.65 0.15 85)')).toBe('oklch(0.76 0.15 90)');
      expect(normalizeProjectColor('oklch(0.65 0.15 90)')).toBe('oklch(0.76 0.15 90)');
    });
    
    it('should migrate 0.65 cyan variations to 0.76 cyan', () => {
      expect(normalizeProjectColor('oklch(0.65 0.15 165)')).toBe('oklch(0.76 0.15 150)');
      expect(normalizeProjectColor('oklch(0.65 0.15 180)')).toBe('oklch(0.76 0.15 180)');
      expect(normalizeProjectColor('oklch(0.65 0.15 185)')).toBe('oklch(0.76 0.15 180)');
    });
    
    it('should migrate 0.65 blue variations to 0.76 blue', () => {
      expect(normalizeProjectColor('oklch(0.65 0.15 240)')).toBe('oklch(0.76 0.15 240)');
      expect(normalizeProjectColor('oklch(0.65 0.15 245)')).toBe('oklch(0.76 0.15 240)');
    });
    
    it('should migrate 0.65 purple variations to 0.76 purple', () => {
      expect(normalizeProjectColor('oklch(0.65 0.15 265)')).toBe('oklch(0.76 0.15 270)');
      expect(normalizeProjectColor('oklch(0.65 0.15 270)')).toBe('oklch(0.76 0.15 270)');
      expect(normalizeProjectColor('oklch(0.65 0.15 285)')).toBe('oklch(0.76 0.15 270)');
    });
    
    it('should migrate 0.65 pink variations to 0.76 pink', () => {
      expect(normalizeProjectColor('oklch(0.65 0.15 300)')).toBe('oklch(0.76 0.15 300)');
      expect(normalizeProjectColor('oklch(0.65 0.15 305)')).toBe('oklch(0.76 0.15 300)');
      expect(normalizeProjectColor('oklch(0.65 0.15 325)')).toBe('oklch(0.76 0.15 330)');
      expect(normalizeProjectColor('oklch(0.65 0.15 330)')).toBe('oklch(0.76 0.15 330)');
    });
  });
  
  describe('Old muted colors (0.55 lightness)', () => {
    it('should migrate muted red to bright red', () => {
      expect(normalizeProjectColor('oklch(0.55 0.08 25)')).toBe('oklch(0.76 0.15 0)');
    });
    
    it('should migrate muted lime to bright lime', () => {
      expect(normalizeProjectColor('oklch(0.55 0.08 85)')).toBe('oklch(0.76 0.15 90)');
    });
    
    it('should migrate muted cyan to bright cyan', () => {
      expect(normalizeProjectColor('oklch(0.55 0.08 165)')).toBe('oklch(0.76 0.15 150)');
    });
    
    it('should migrate muted blue to bright blue', () => {
      expect(normalizeProjectColor('oklch(0.55 0.08 245)')).toBe('oklch(0.76 0.15 240)');
    });
    
    it('should migrate muted pink to bright pink', () => {
      expect(normalizeProjectColor('oklch(0.55 0.08 325)')).toBe('oklch(0.76 0.15 330)');
    });
  });
  
  describe('Unmapped colors with hue snapping', () => {
    it('should snap hue 10 to nearest (0)', () => {
      const result = normalizeProjectColor('oklch(0.80 0.15 10)');
      expect(result).toBe('oklch(0.76 0.15 0)');
    });
    
    it('should snap hue 45 to nearest (30)', () => {
      const result = normalizeProjectColor('oklch(0.80 0.15 45)');
      expect(result).toBe('oklch(0.76 0.15 30)');
    });
    
    it('should snap hue 75 to nearest (60)', () => {
      const result = normalizeProjectColor('oklch(0.80 0.15 75)');
      expect(result).toBe('oklch(0.76 0.15 60)');
    });
    
    it('should snap hue 105 to nearest (90)', () => {
      const result = normalizeProjectColor('oklch(0.80 0.15 105)');
      expect(result).toBe('oklch(0.76 0.15 90)');
    });
    
    it('should snap hue 135 to nearest (120)', () => {
      const result = normalizeProjectColor('oklch(0.80 0.15 135)');
      expect(result).toBe('oklch(0.76 0.15 120)');
    });
    
    it('should snap hue 165 to nearest (150)', () => {
      const result = normalizeProjectColor('oklch(0.80 0.15 165)');
      expect(result).toBe('oklch(0.76 0.15 150)');
    });
    
    it('should snap hue 195 to nearest (180)', () => {
      const result = normalizeProjectColor('oklch(0.80 0.15 195)');
      expect(result).toBe('oklch(0.76 0.15 180)');
    });
    
    it('should snap hue 225 to nearest (210)', () => {
      const result = normalizeProjectColor('oklch(0.80 0.15 225)');
      expect(result).toBe('oklch(0.76 0.15 210)');
    });
    
    it('should snap hue 255 to nearest (240)', () => {
      const result = normalizeProjectColor('oklch(0.80 0.15 255)');
      expect(result).toBe('oklch(0.76 0.15 240)');
    });
    
    it('should snap hue 285 to nearest (270)', () => {
      const result = normalizeProjectColor('oklch(0.80 0.15 285)');
      expect(result).toBe('oklch(0.76 0.15 270)');
    });
    
    it('should snap hue 315 to nearest (300)', () => {
      const result = normalizeProjectColor('oklch(0.80 0.15 315)');
      expect(result).toBe('oklch(0.76 0.15 300)');
    });
    
    it('should snap hue 345 to nearest (330)', () => {
      const result = normalizeProjectColor('oklch(0.80 0.15 345)');
      expect(result).toBe('oklch(0.76 0.15 330)');
    });
  });
  
  describe('Invalid colors', () => {
    it('should return default color for invalid format', () => {
      const result = normalizeProjectColor('invalid-color');
      expect(result).toBe('oklch(0.76 0.15 0)'); // Default red
    });
    
    it('should return default color for non-OKLCH format', () => {
      const result = normalizeProjectColor('#ff0000');
      expect(result).toBe('oklch(0.76 0.15 0)');
    });
    
    it('should return default color for RGB format', () => {
      const result = normalizeProjectColor('rgb(255, 0, 0)');
      expect(result).toBe('oklch(0.76 0.15 0)');
    });
  });
  
  describe('Edge cases', () => {
    it('should handle hue 0 (red) correctly', () => {
      const result = normalizeProjectColor('oklch(0.80 0.15 0)');
      expect(result).toBe('oklch(0.76 0.15 0)');
    });
    
    it('should handle hue 360 snapping to closest (330)', () => {
      // Hue 360 is equivalent to 0, but closest palette match is 330
      const result = normalizeProjectColor('oklch(0.80 0.15 360)');
      expect(result).toBe('oklch(0.76 0.15 330)');
    });
    
    it('should handle decimal hues', () => {
      const result = normalizeProjectColor('oklch(0.80 0.15 44.5)');
      expect(result).toBe('oklch(0.76 0.15 30)');
    });
  });
});

describe('needsColorNormalization', () => {
  it('should return false for new palette colors', () => {
    expect(needsColorNormalization('oklch(0.76 0.15 0)')).toBe(false);
    expect(needsColorNormalization('oklch(0.76 0.15 30)')).toBe(false);
    expect(needsColorNormalization('oklch(0.76 0.15 120)')).toBe(false);
  });
  
  it('should return true for old 0.72 colors', () => {
    expect(needsColorNormalization('oklch(0.72 0.15 0)')).toBe(true);
    expect(needsColorNormalization('oklch(0.72 0.15 30)')).toBe(true);
  });
  
  it('should return true for old 0.65 colors', () => {
    expect(needsColorNormalization('oklch(0.65 0.15 0)')).toBe(true);
    expect(needsColorNormalization('oklch(0.65 0.15 25)')).toBe(true);
  });
  
  it('should return true for muted colors', () => {
    expect(needsColorNormalization('oklch(0.55 0.08 25)')).toBe(true);
  });
  
  it('should return true for unknown colors', () => {
    expect(needsColorNormalization('oklch(0.80 0.15 15)')).toBe(true);
    expect(needsColorNormalization('invalid-color')).toBe(true);
  });
});
