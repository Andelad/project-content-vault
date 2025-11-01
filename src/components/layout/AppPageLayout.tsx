import React from 'react';
import { cn } from '../../lib/utils';

interface AppPageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

interface AppPageHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface AppPageSubHeaderProps {
  children?: React.ReactNode; // Optional children
  className?: string;
}

interface AppPageContentProps {
  children: React.ReactNode;
  className?: string;
}

export function AppPageLayout({ children, className }: AppPageLayoutProps) {
  return (
    <div className={cn("h-full flex flex-col bg-[#fcfcfc] overflow-hidden", className)}>
      {children}
    </div>
  );
}

export function AppPageHeader({ children, className }: AppPageHeaderProps) {
  return (
    <div className={cn("shrink-0", className)}>
      {children}
    </div>
  );
}

export function AppPageSubHeader({ children, className }: AppPageSubHeaderProps) {
  // Don't render anything if no children provided
  if (!children) {
    return null;
  }
  
  return (
    <div className={cn("px-6 py-[21px] shrink-0", className)}>
      {children}
    </div>
  );
}

export function AppPageContent({ children, className }: AppPageContentProps) {
  return (
    <div className={cn("flex-1 flex flex-col px-6 pb-6 min-h-0", className)}>
      {children}
    </div>
  );
}

// Compound component pattern
AppPageLayout.Header = AppPageHeader;
AppPageLayout.SubHeader = AppPageSubHeader;
AppPageLayout.Content = AppPageContent;
