import React, { useState, useEffect, useCallback } from 'react';
import { useTimelineContext } from '../../contexts/TimelineContext';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, AlignLeft, Folders, Settings, ChevronLeft, ChevronRight, PieChart, MessageCircle } from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';

export function Sidebar() {
  const { currentView, setCurrentView, mainSidebarCollapsed, setMainSidebarCollapsed } = useTimelineContext();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, display_name')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error:', error);
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
      label: 'Projects',
      icon: Folders,
    },
    {
      id: 'feedback' as const,
      label: 'Feedback',
      icon: MessageCircle,
    },
  ];

  const bottomNavItems = [
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <div className={`${mainSidebarCollapsed ? 'w-16' : 'w-48'} h-full bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out relative flex-shrink-0`}>
      {/* Header */}
      <div className={`h-20 px-6 border-b border-gray-200 flex items-center ${mainSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
        {mainSidebarCollapsed ? (
          <img src="/lovable-uploads/b7b3f5f1-d45e-4fc7-9113-f39c988b4951.png" alt="Budgi Logo" className="w-4 h-4" />
        ) : (
          <div className="flex items-center gap-3">
            <img src="/lovable-uploads/b7b3f5f1-d45e-4fc7-9113-f39c988b4951.png" alt="Budgi Logo" className="w-5 h-5" />
            <h1 className="text-lg font-medium text-[#595956]">Budgi</h1>
          </div>
        )}
        
        {/* Collapse Toggle Button - Positioned over right edge */}
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
      </div>

      {/* Main Navigation */}
      <nav className={`flex-1 overflow-y-auto ${mainSidebarCollapsed ? 'px-[14px] py-[21px]' : 'px-6 pt-[21px] pb-4'} flex flex-col`}>
        <ul className="space-y-2">
          {mainNavItems.filter(item => item.id !== 'feedback').map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setCurrentView(item.id)}
                  className={`${mainSidebarCollapsed ? 'w-9 h-9 flex items-center justify-center' : 'w-full h-9 flex items-center px-4'} rounded-lg transition-colors duration-200 ${
                    currentView === item.id
                      ? 'bg-gray-200 text-gray-800'
                      : 'text-gray-600 hover:bg-gray-150 hover:text-gray-800'
                  }`}
                  title={mainSidebarCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${!mainSidebarCollapsed ? 'mr-3' : ''}`} />
                  {!mainSidebarCollapsed && <span className="font-medium">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        
        {/* Feedback button aligned to bottom */}
        <ul className="mt-auto space-y-2">
          {mainNavItems.filter(item => item.id === 'feedback').map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setCurrentView(item.id)}
                  className={`${mainSidebarCollapsed ? 'w-9 h-9 flex items-center justify-center' : 'w-full h-9 flex items-center px-4'} rounded-lg transition-colors duration-200 ${
                    currentView === item.id
                      ? 'bg-gray-200 text-gray-800'
                      : 'text-gray-600 hover:bg-gray-150 hover:text-gray-800'
                  }`}
                  title={mainSidebarCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${!mainSidebarCollapsed ? 'mr-3' : ''}`} />
                  {!mainSidebarCollapsed && <span className="font-medium">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Avatar and Bottom Navigation */}
      <div className={`${mainSidebarCollapsed ? 'px-[14px] py-4' : 'px-6 py-4'} border-t border-gray-200 flex-shrink-0 space-y-4`}>
        {/* Profile Navigation with Avatar */}
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => setCurrentView('profile')}
              className={`${mainSidebarCollapsed ? 'w-9 h-9 flex items-center justify-center' : 'w-full h-9 flex items-center px-4'} rounded-lg transition-colors duration-200 ${
                currentView === 'profile'
                  ? 'bg-gray-200 text-gray-800'
                  : 'text-gray-600 hover:bg-gray-150 hover:text-gray-800'
              }`}
              title={mainSidebarCollapsed ? 'Profile' : undefined}
            >
              <div className={`${mainSidebarCollapsed ? 'w-8 h-8' : 'w-5 h-5 mr-3'} rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 overflow-hidden`}>
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
              {!mainSidebarCollapsed && <span className="font-medium">Profile</span>}
            </button>
          </li>
        </ul>
        
        {/* Bottom Navigation */}
        <ul className="space-y-2">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setCurrentView(item.id)}
                  className={`${mainSidebarCollapsed ? 'w-9 h-9 flex items-center justify-center' : 'w-full h-9 flex items-center px-4'} rounded-lg transition-colors duration-200 ${
                    currentView === item.id
                      ? 'bg-gray-200 text-gray-800'
                      : 'text-gray-600 hover:bg-gray-150 hover:text-gray-800'
                  }`}
                  title={mainSidebarCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${!mainSidebarCollapsed ? 'mr-3' : ''}`} />
                  {!mainSidebarCollapsed && <span className="font-medium">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}