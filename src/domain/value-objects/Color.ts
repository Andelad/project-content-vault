/**
 * Color Value Object
 * 
 * Represents a validated color value (hex format).
 * Encapsulates color validation and manipulation logic.
 * 
 * Usage:
 * ```typescript
 * const colorResult = Color.create('#3b82f6');
 * if (colorResult.success) {
 *   const color = colorResult.data!;
 *   console.log(color.hex); // '#3b82f6'
 *   console.log(color.rgb); // { r: 59, g: 130, b: 246 }
 * }
 * ```
 */

import type { DomainResult } from '@/domain/entities/Project';

export class Color {
  private constructor(private readonly _hex: string) {}

  // Hex color regex (supports #RGB and #RRGGBB)
  private static readonly HEX_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

  // Default colors for different entity types
  static readonly DEFAULTS = {
    PROJECT: '#3b82f6', // Blue
    PHASE: '#8b5cf6',   // Purple
    LABEL: '#10b981',   // Green
    CLIENT: '#f59e0b',  // Amber
  };

  // Factory method with validation
  static create(color: string | null | undefined): DomainResult<Color> {
    // Empty color is invalid
    if (!color || color.trim() === '') {
      return {
        success: false,
        errors: ['Color is required'],
      };
    }

    const trimmed = color.trim();

    // Validate format
    if (!this.HEX_REGEX.test(trimmed)) {
      return {
        success: false,
        errors: ['Invalid color format (must be hex: #RGB or #RRGGBB)'],
      };
    }

    // Normalize 3-digit hex to 6-digit
    let normalized = trimmed;
    if (trimmed.length === 4) {
      // #RGB -> #RRGGBB
      normalized = `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
    }

    return { success: true, data: new Color(normalized.toLowerCase()) };
  }

  // Factory method for optional color with default
  static createWithDefault(
    color: string | null | undefined,
    defaultColor: string
  ): DomainResult<Color> {
    if (!color || color.trim() === '') {
      return Color.create(defaultColor);
    }
    return Color.create(color);
  }

  // Factory method from RGB values
  static fromRGB(r: number, g: number, b: number): DomainResult<Color> {
    const errors: string[] = [];

    if (r < 0 || r > 255) errors.push('Red value must be 0-255');
    if (g < 0 || g > 255) errors.push('Green value must be 0-255');
    if (b < 0 || b > 255) errors.push('Blue value must be 0-255');

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const hex = `#${this.componentToHex(r)}${this.componentToHex(g)}${this.componentToHex(b)}`;
    return Color.create(hex);
  }

  private static componentToHex(c: number): string {
    const hex = Math.round(c).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  // Getters
  get hex(): string {
    return this._hex;
  }

  get rgb(): { r: number; g: number; b: number } {
    const r = parseInt(this._hex.slice(1, 3), 16);
    const g = parseInt(this._hex.slice(3, 5), 16);
    const b = parseInt(this._hex.slice(5, 7), 16);
    return { r, g, b };
  }

  get hsl(): { h: number; s: number; l: number } {
    const { r, g, b } = this.rgb;
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

      if (max === rNorm) {
        h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) / 6;
      } else if (max === gNorm) {
        h = ((bNorm - rNorm) / delta + 2) / 6;
      } else {
        h = ((rNorm - gNorm) / delta + 4) / 6;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  // Comparison
  equals(other: Color): boolean {
    return this._hex === other._hex;
  }

  // Color manipulation
  lighten(percent: number): DomainResult<Color> {
    const { h, s, l } = this.hsl;
    const newL = Math.min(100, l + percent);
    return this.fromHSL(h, s, newL);
  }

  darken(percent: number): DomainResult<Color> {
    const { h, s, l } = this.hsl;
    const newL = Math.max(0, l - percent);
    return this.fromHSL(h, s, newL);
  }

  private fromHSL(h: number, s: number, l: number): DomainResult<Color> {
    const hNorm = h / 360;
    const sNorm = s / 100;
    const lNorm = l / 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = lNorm;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
      const p = 2 * lNorm - q;

      r = hue2rgb(p, q, hNorm + 1 / 3);
      g = hue2rgb(p, q, hNorm);
      b = hue2rgb(p, q, hNorm - 1 / 3);
    }

    return Color.fromRGB(
      Math.round(r * 255),
      Math.round(g * 255),
      Math.round(b * 255)
    );
  }

  // Luminance calculation for contrast checking
  getLuminance(): number {
    const { r, g, b } = this.rgb;
    const [rNorm, gNorm, bNorm] = [r, g, b].map(c => {
      const val = c / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rNorm + 0.7152 * gNorm + 0.0722 * bNorm;
  }

  // Check if color has good contrast with another color
  hasGoodContrast(other: Color): boolean {
    const l1 = this.getLuminance();
    const l2 = other.getLuminance();
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return ratio >= 4.5; // WCAG AA standard for normal text
  }

  // Serialization
  toString(): string {
    return this._hex;
  }

  toJSON(): string {
    return this._hex;
  }
}
