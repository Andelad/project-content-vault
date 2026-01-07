import React, { useState, useEffect, useCallback } from 'react';
import { useTimelineContext } from '../../contexts/TimelineContext';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, AlignLeft, Folders, Settings, ChevronLeft, ChevronRight, PieChart, MessageSquare, GraduationCap } from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import { Sheet, SheetContent } from '../ui/sheet';
import { HelpModal } from '../modals/HelpModal';
import { FeedbackModal } from '../modals/FeedbackModal';
import { ErrorHandlingService } from '@/infrastructure/ErrorHandlingService';
import type { Database } from '@/integrations/supabase/types';

const isBrowser = typeof window !== 'undefined';

interface SidebarProps {
  mainSidebarCollapsed: boolean;
  setMainSidebarCollapsed: (collapsed: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export function Sidebar({ 
  mainSidebarCollapsed, 
  setMainSidebarCollapsed, 
  mobileMenuOpen, 
  setMobileMenuOpen 
}: SidebarProps) {
  const { currentView, setCurrentView, setCurrentDate } = useTimelineContext();
  const { user } = useAuth();
  type ProfileRow = Database['public']['Tables']['profiles']['Row'];
  type AvatarProfile = {
    avatar_url?: string | null;
    display_name?: string | null;
    user_id?: string | null;
  };
  const [profile, setProfile] = useState<AvatarProfile | null>(null);
  const [isMobile, setIsMobile] = useState(() => (isBrowser ? window.innerWidth < 768 : false));
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

  // Detect mobile size (< 768px)
  useEffect(() => {
    if (!isBrowser) return;

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, display_name, user_id')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        ErrorHandlingService.handle(error, { source: 'Sidebar', action: 'Error fetching profile:' });
      } else {
        setProfile(data);
      }
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'Sidebar', action: 'Error:' });
    }
  }, [user?.id]);

  // Load user profile for avatar
  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  // Listen for storage changes to refresh avatar when updated
  useEffect(() => {
    const handleStorageChange = () => {
      if (user) {
        fetchProfile();
      }
    };

    // Listen for custom events from profile updates
    window.addEventListener('profile-updated', handleStorageChange);
    
    return () => {
      window.removeEventListener('profile-updated', handleStorageChange);
    };
  }, [user, fetchProfile]);

  const mainNavItems = [
    {
      id: 'timeline' as const,
      label: 'Timeline',
      icon: AlignLeft,
    },
    {
      id: 'calendar' as const,
      label: 'Planner',
      icon: Calendar,
    },
    {
      id: 'insights' as const,
      label: 'Insights',
      icon: PieChart,
    },
    {
      id: 'projects' as const,
      label: 'Overview',
      icon: Folders,
    },
  ];

  const bottomNavItems = [
    {
      id: 'help' as const,
      label: 'Help',
      icon: GraduationCap,
      onClick: () => setHelpModalOpen(true),
    },
    {
      id: 'feedback' as const,
      label: 'Feedback',
      icon: MessageSquare,
      onClick: () => setFeedbackModalOpen(true),
    },
  ];

  const settingsNavItems = [
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: Settings,
    },
  ];

  // Sidebar content component (reused for both mobile Sheet and desktop sidebar)
  // Pass isCollapsed prop to control layout
  const SidebarContent = ({ isCollapsed = false }: { isCollapsed?: boolean }) => (
    <>
      {/* Header */}
      <div className={`h-20 border-b border-gray-200 flex items-center ${isCollapsed ? 'px-6 justify-center' : 'px-[14px] justify-between'}`}>
        {isCollapsed ? (
          <img src="/lovable-uploads/b7b3f5f1-d45e-4fc7-9113-f39c988b4951.png" alt="Budgi Logo" className="w-4 h-4" />
        ) : (
          <div className="flex items-center gap-3">
            <img src="/lovable-uploads/b7b3f5f1-d45e-4fc7-9113-f39c988b4951.png" alt="Budgi Logo" className="w-5 h-5" />
            <h1 className="text-lg font-semibold text-muted-foreground">Budgi</h1>
          </div>
        )}
        
        {/* Collapse Toggle Button - Desktop only */}
        {!isMobile && (
          <button
            onClick={() => setMainSidebarCollapsed(!mainSidebarCollapsed)}
            className="absolute top-7 -right-3 w-6 h-6 bg-white border border-gray-200 rounded-md flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors duration-200 z-10"
          >
            {mainSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-[14px] py-[21px]' : 'px-[14px] pt-[21px] pb-4'} flex flex-col`}>
        <ul className="space-y-2">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    // Sidebar navigation: always jump planner to today by default
                    if (item.id === 'calendar') {
                      setCurrentDate(new Date());
                    }
                    setCurrentView(item.id);
                    if (isMobile) setMobileMenuOpen(false);
                  }}
                  className={`${isCollapsed ? 'w-9 h-9 flex items-center justify-center' : 'w-full h-9 flex items-center px-4'} rounded-lg transition-colors duration-200 ${
                    currentView === item.id
                      ? 'bg-gray-200 text-gray-800'
                      : 'text-gray-600 hover:bg-gray-150 hover:text-gray-800'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${!isCollapsed ? 'mr-3' : ''}`} />
                  {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        
        {/* Bottom navigation buttons aligned to bottom */}
        <ul className="mt-auto space-y-2">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    if (item.onClick) {
                      item.onClick();
                    } else {
                      setCurrentView(item.id);
                    }
                    if (isMobile) setMobileMenuOpen(false);
                  }}
                  className={`${isCollapsed ? 'w-9 h-9 flex items-center justify-center' : 'w-full h-9 flex items-center px-4'} rounded-lg transition-colors duration-200 ${
                    currentView === item.id && !item.onClick
                      ? 'bg-gray-200 text-gray-800'
                      : 'text-gray-600 hover:bg-gray-150 hover:text-gray-800'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${!isCollapsed ? 'mr-3' : ''}`} />
                  {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Avatar and Bottom Navigation */}
      <div className={`${isCollapsed ? 'px-[14px] py-4' : 'px-[14px] py-4'} border-t border-gray-200 flex-shrink-0 space-y-4`}>
        {/* Profile Navigation with Avatar */}
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => {
                setCurrentView('profile');
                if (isMobile) setMobileMenuOpen(false);
              }}
              className={`${isCollapsed ? 'w-9 h-9 flex items-center justify-center' : 'w-full h-9 flex items-center px-4'} rounded-lg transition-colors duration-200 ${
                currentView === 'profile'
                  ? 'bg-gray-200 text-gray-800'
                  : 'text-gray-600 hover:bg-gray-150 hover:text-gray-800'
              }`}
              title={isCollapsed ? 'Profile' : undefined}
            >
              <div className={`${isCollapsed ? 'w-8 h-8' : 'w-5 h-5 mr-3'} rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 overflow-hidden`}>
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Profile avatar" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="bg-[#595956] text-white w-full h-full rounded-full flex items-center justify-center">
                    {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
              {!isCollapsed && <span className="font-medium text-sm">Profile</span>}
            </button>
          </li>
        </ul>
        
        {/* Bottom Navigation */}
        <ul className="space-y-2">
          {settingsNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    setCurrentView(item.id);
                    if (isMobile) setMobileMenuOpen(false);
                  }}
                  className={`${isCollapsed ? 'w-9 h-9 flex items-center justify-center' : 'w-full h-9 flex items-center px-4'} rounded-lg transition-colors duration-200 ${
                    currentView === item.id
                      ? 'bg-gray-200 text-gray-800'
                      : 'text-gray-600 hover:bg-gray-150 hover:text-gray-800'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${!isCollapsed ? 'mr-3' : ''}`} />
                  {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );

  // Mobile: Sheet overlay from left edge
  if (isMobile) {
    return (
      <>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-48 p-0 bg-stone-100">
            <SidebarContent isCollapsed={false} />
          </SheetContent>
        </Sheet>
        <HelpModal open={helpModalOpen} onOpenChange={setHelpModalOpen} />
        <FeedbackModal open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen} />
      </>
    );
  }

  // Desktop: Regular sidebar
  return (
    <div 
      className={`${mainSidebarCollapsed ? 'w-16' : 'w-48'} h-full bg-stone-100 border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out relative flex-shrink-0`}
      style={{ boxShadow: '2px 0 3px 0 rgb(0 0 0 / 0.03), 2px 0 2px -1px rgb(0 0 0 / 0.03)' }}
    >
      <SidebarContent isCollapsed={mainSidebarCollapsed} />
      <HelpModal open={helpModalOpen} onOpenChange={setHelpModalOpen} />
      <FeedbackModal open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen} />
    </div>
  );
}