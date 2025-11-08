import React, { useState, useEffect, ReactNode } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Menu, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const isBrowser = typeof window !== 'undefined';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarLayoutProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  sidebarTitle: string;
  renderContent: () => ReactNode;
  className?: string;
}

export function SidebarLayout({
  tabs,
  activeTab,
  onTabChange,
  sidebarTitle,
  renderContent,
  className
}: SidebarLayoutProps) {
  const [isMobile, setIsMobile] = useState(() => (isBrowser ? window.innerWidth < 768 : false));
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (!isBrowser) return false;
    // Start open on desktop, closed on mobile
    return window.innerWidth >= 768;
  });

  // Detect mobile size (< 768px)
  useEffect(() => {
    if (!isBrowser) return;

    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      const wasMobile = isMobile;
      setIsMobile(mobile);

      // Only auto-open/close if transitioning between mobile and desktop
      if (mobile !== wasMobile) {
        if (!mobile) {
          // Transitioning to desktop - open sidebar
          setSidebarOpen(true);
        } else {
          // Transitioning to mobile - close sidebar
          setSidebarOpen(false);
        }
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, [isMobile]);

  // Sidebar content component
  const SidebarContent = () => (
    <>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{sidebarTitle}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(false)}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      
      <nav className="flex-1 overflow-y-auto light-scrollbar p-2">
        <div className="space-y-0">
          {tabs.map((tab, index) => (
            <React.Fragment key={tab.id}>
              <button
                onClick={() => {
                  onTabChange(tab.id);
                  if (isMobile) setSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-[#02c0b7] text-white"
                    : "text-gray-700 hover:bg-gray-200/70 hover:text-gray-900"
                )}
              >
                <tab.icon className="w-4 h-4 flex-shrink-0" />
                <span>{tab.label}</span>
              </button>
              {index < tabs.length - 1 && (
                <div className="border-b border-gray-200 mx-2" />
              )}
            </React.Fragment>
          ))}
        </div>
      </nav>
    </>
  );

  return (
    <Card className={cn("h-full flex overflow-hidden max-w-[1216px] relative", className)}>
      {/* Mobile: Sidebar slides over content within card */}
      {isMobile && (
        <div 
          className={cn(
            "absolute inset-y-0 left-0 z-20 w-64 bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out",
            sidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full shadow-none"
          )}
        >
          <SidebarContent />
        </div>
      )}

      {/* Desktop: Sidebar squeezes content */}
      <div 
        className={cn(
          "relative flex-shrink-0 bg-gray-50 transition-all duration-300 ease-in-out overflow-hidden",
          !isMobile && sidebarOpen ? "w-64 border-r border-gray-200" : "w-0"
        )}
      >
        <div className="h-full flex flex-col w-64">
          <SidebarContent />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Always visible with hamburger + title */}
        <div className="p-4 border-b border-gray-200 flex items-center gap-3">
          {!sidebarOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          {sidebarOpen && <div className="w-8 h-8 flex-shrink-0" />}
          <h2 className="font-semibold text-gray-900">
            {tabs.find(tab => tab.id === activeTab)?.label}
          </h2>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto light-scrollbar">
          <div className="p-8 w-full max-w-4xl">
            {renderContent()}
          </div>
        </div>
      </div>
    </Card>
  );
}
