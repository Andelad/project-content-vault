import React from 'react';
import { NEUTRAL_COLORS } from '@/presentation/app/constants/colors';

interface TabComponentProps {
  label: string;
  value?: string;
  isActive: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  height?: number; // Optional custom height for active tab
}

export function TabComponent({ label, isActive, onClick, icon, height = 36 }: TabComponentProps) {
  const activeHeight = height;
  const inactiveHeight = height - 1;
  
  return (
    <button
      onClick={onClick}
      className={`
        relative px-6 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
        text-gray-800
        ${isActive ? 'z-10' : 'z-0'}
      `}
      style={{
        height: isActive ? `${activeHeight}px` : `${inactiveHeight}px`,
        backgroundColor: isActive ? 'white' : NEUTRAL_COLORS.gray150,
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        marginRight: '2px',
        borderTop: `1px solid ${NEUTRAL_COLORS.gray200}`,
        borderLeft: `1px solid ${NEUTRAL_COLORS.gray200}`,
        borderRight: `1px solid ${NEUTRAL_COLORS.gray200}`,
        borderBottom: isActive ? '1px solid white' : '1px solid transparent',
        marginBottom: '-1px',
        boxSizing: 'border-box',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
