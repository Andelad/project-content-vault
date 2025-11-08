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
        height: isActive ? '36px' : '35px',
        backgroundColor: isActive ? 'white' : NEUTRAL_COLORS.gray150,
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        marginRight: '-2px',
        borderTop: `1px solid ${NEUTRAL_COLORS.gray200}`,
        borderLeft: `1px solid ${NEUTRAL_COLORS.gray200}`,
        borderRight: `1px solid ${NEUTRAL_COLORS.gray200}`,
        borderBottom: isActive ? '1px solid white' : '1px solid transparent',
        marginBottom: '-1px',
        boxSizing: 'border-box',
      }}
    >
      {label}
    </button>
  );
}
