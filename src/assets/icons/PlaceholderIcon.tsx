// Common icon component template
// This is a placeholder for future icons - replace with actual icon implementations

import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

export default function PlaceholderIcon({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      fill={color}
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
      <text x="12" y="12" textAnchor="middle" dy="0.3em" fontSize="8" fill={color}>
        Icon
      </text>
    </svg>
  );
}
