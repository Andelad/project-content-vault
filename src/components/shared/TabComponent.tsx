import React from 'react';
import { NEUTRAL_COLORS } from '@/constants/colors';

interface TabComponentProps {
  label: string;
  value?: string;
  isActive: boolean;
  onClick: () => void;
}

export function TabComponent({ label, isActive, onClick }: TabComponentProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative px-6 text-sm font-medium transition-all duration-200 flex items-center justify-center
        text-gray-800
        ${isActive ? 'z-10' : 'z-0'}
      `}
      style={{
        height: isActive ? '40px' : '39px',
        backgroundColor: isActive ? 'white' : NEUTRAL_COLORS.gray200,
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        marginRight: '-2px',
        borderTop: `1px solid ${isActive ? NEUTRAL_COLORS.gray200 : 'transparent'}`,
        borderLeft: `1px solid ${isActive ? NEUTRAL_COLORS.gray200 : 'transparent'}`,
        borderRight: `1px solid ${isActive ? NEUTRAL_COLORS.gray200 : 'transparent'}`,
        borderBottom: isActive ? '1px solid white' : '1px solid transparent',
        marginBottom: '-1px',
        boxSizing: 'border-box',
      }}
    >
      {label}
    </button>
  );
}
