import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

import { Bell, Palette, Clock, Globe, Shield, Trash2, User, Plus, X, Calendar, FolderKanban, Download } from 'lucide-react';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { WorkSlot } from '@/types/core';
import { CalendarImport } from './CalendarImport';
import { PWASettings } from './PWASettings';
import { useToast } from '../../hooks/use-toast';
import { formatDuration } from '@/services';
import { AppPageLayout } from '../layout/AppPageLayout';
import { formatWorkSlotDurationDisplay } from '@/services';
import { SettingsOrchestrator } from '@/services/orchestrators/SettingsOrchestrator';
import { CardSidebarLayout } from '../shared/CardSidebarLayout';
import { useGroups } from '@/hooks/useGroups';
import {
  generateTimeOptions,
  calculateDayTotalHours,
  calculateWeekTotalHours,
  createNewWorkSlot,
  updateWorkSlot,
  generateDefaultWorkSchedule
} from '@/services';

export function SettingsView() {
  const { settings: appSettings, updateSettings, setDefaultView } = useSettingsContext();
  const { toast } = useToast();
  const { groups, loading: groupsLoading, addGroup, updateGroup, deleteGroup } = useGroups();
  const [activeTab, setActiveTab] = useState('general');
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [localSettings, setLocalSettings] = useState({
    notifications: true,
    emailNotifications: false,
    darkMode: false,
    timeFormat: '12h',
    timezone: 'UTC-8',
    language: 'en',
    autoSave: true,
    defaultView: 'projects'
  });

  // Sync app settings with local state
  useEffect(() => {
    setLocalSettings(prev => ({
      ...prev,
      defaultView: appSettings.defaultView || 'timeline'
    }));
  }, [appSettings.defaultView]);

  const handleSettingChange = async (key: string, value: any) => {
    // Delegate to SettingsOrchestrator (AI Rule: use existing orchestrator)
    const result = await SettingsOrchestrator.updateSetting(
      key,
      value,
      {
        setLocalSettings,
        updateSettings,
        setDefaultView
      }
    );

    if (result.success && result.message) {
      toast({
        title: result.message.includes('view') ? "Default view updated" : "Setting updated",
        description: result.message,
      });
    } else if (!result.success) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  // Helper functions for work slots using the service
  const timeOptions = generateTimeOptions(true); // Use 24-hour format

  const getDayTotal = (slots: WorkSlot[]): number => {
    return calculateDayTotalHours(slots);
  };

  const getWeekTotal = (): number => {
    return calculateWeekTotalHours(appSettings.weeklyWorkHours);
  };

  const addWorkSlot = (day: string) => {
    const daySlots = appSettings.weeklyWorkHours[day as keyof typeof appSettings.weeklyWorkHours] || [];
    
    const result = createNewWorkSlot(day, daySlots);
    if (!result.success) {
      toast({
        title: "Cannot add work slot",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    updateSettings({
      weeklyWorkHours: {
        ...appSettings.weeklyWorkHours,
        [day]: [...daySlots, result.slot!]
      }
    });
  };

  const updateWorkSlotHandler = (day: string, slotId: string, updates: Partial<WorkSlot>) => {
    const daySlots = appSettings.weeklyWorkHours[day as keyof typeof appSettings.weeklyWorkHours] || [];
    const updatedSlots = daySlots.map(slot => {
      if (slot.id === slotId) {
        return updateWorkSlot(slot, updates);
      }
      return slot;
    });

    updateSettings({
      weeklyWorkHours: {
        ...appSettings.weeklyWorkHours,
        [day]: updatedSlots
      }
    });
  };

  const removeWorkSlot = (day: string, slotId: string) => {
    const daySlots = appSettings.weeklyWorkHours[day as keyof typeof appSettings.weeklyWorkHours] || [];
    const updatedSlots = daySlots.filter(slot => slot.id !== slotId);

    updateSettings({
      weeklyWorkHours: {
        ...appSettings.weeklyWorkHours,
        [day]: updatedSlots
      }
    });
  };

  const handleSaveSettings = async () => {
    // Delegate to SettingsOrchestrator (AI Rule: use existing orchestrator)
    const result = await SettingsOrchestrator.saveAllSettings(
      localSettings,
      { updateSettings }
    );

    toast({
      title: result.message || (result.success ? "Settings saved" : "Error"),
      description: result.success ? result.message : result.error,
      variant: result.success ? "default" : "destructive",
    });
  };

  const handleResetSettings = () => {
    // Delegate to SettingsOrchestrator (AI Rule: use existing orchestrator)
    const result = SettingsOrchestrator.resetToDefaults();
    
    if (result.success) {
      setLocalSettings(result.resetSettings);
      // Use service to generate default work schedule
      const defaultWeek = generateDefaultWorkSchedule('standard');
      updateSettings({ weeklyWorkHours: defaultWeek });
      toast({
        title: "Settings reset",
        description: "All settings have been reset to defaults",
      });
    }
  };

  const handleClearData = async () => {
    // Implementation for clearing app data
    if (confirm('Are you sure you want to clear all app data? This action cannot be undone.')) {
      // Delegate to SettingsOrchestrator (AI Rule: use existing orchestrator)
      const result = await SettingsOrchestrator.clearApplicationData();
      
      toast({
        title: result.success ? "Data cleared" : "Error",
        description: result.message || result.error,
        variant: result.success ? "default" : "destructive",
      });
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'groups', label: 'Groups', icon: FolderKanban },
    { id: 'work', label: 'Work Hours', icon: Clock },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'time', label: 'Time & Date', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'calendar', label: 'Calendar Integration', icon: Calendar },
    { id: 'pwa', label: 'Install App', icon: Download },
    { id: 'privacy', label: 'Data & Privacy', icon: Shield },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">General</h2>
              <p className="text-sm text-gray-600">Basic application preferences and display settings</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="default-view">Default View</Label>
                <Select 
                  value={localSettings.defaultView} 
                  onValueChange={(value) => handleSettingChange('defaultView', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="projects">Projects</SelectItem>
                    <SelectItem value="timeline">Timeline (Days)</SelectItem>
                    <SelectItem value="timeline-weeks">Timeline (Weeks)</SelectItem>
                    <SelectItem value="calendar">Calendar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select 
                  value={localSettings.language} 
                  onValueChange={(value) => handleSettingChange('language', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Auto-save</Label>
                <p className="text-sm text-gray-600">Automatically save changes as you work</p>
              </div>
              <Switch
                checked={localSettings.autoSave}
                onCheckedChange={(checked) => handleSettingChange('autoSave', checked)}
              />
            </div>
          </div>
        );

      case 'work':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Work Hours</h2>
              <p className="text-sm text-gray-600">Configure your daily work schedule and time allocation</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Weekly Work Schedule</Label>
                <p className="text-sm text-gray-600">
                  Set how many hours you want to work each day of the week. This affects time allocation calculations in the timeline.
                </p>
              </div>
              
              <div className="space-y-4">
                {/* Summary */}
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-sm font-medium text-blue-900">Total weekly hours:</span>
                  <span className="text-lg font-semibold text-blue-600">
                    {formatDuration(getWeekTotal())}
                  </span>
                </div>
                
                {/* Daily Work Slots */}
                <div className="space-y-6">
                  {[
                    { key: 'monday', label: 'Monday' },
                    { key: 'tuesday', label: 'Tuesday' },
                    { key: 'wednesday', label: 'Wednesday' },
                    { key: 'thursday', label: 'Thursday' },
                    { key: 'friday', label: 'Friday' },
                    { key: 'saturday', label: 'Saturday' },
                    { key: 'sunday', label: 'Sunday' }
                  ].map(({ key, label }) => {
                    const daySlots = appSettings.weeklyWorkHours[key as keyof typeof appSettings.weeklyWorkHours] || [];
                    // Sort slots by start time (earliest first)
                    const sortedDaySlots = [...daySlots].sort((a, b) => {
                      const aTime = a.startTime.split(':').map(Number);
                      const bTime = b.startTime.split(':').map(Number);
                      const aMinutes = aTime[0] * 60 + aTime[1];
                      const bMinutes = bTime[0] * 60 + bTime[1];
                      return aMinutes - bMinutes;
                    });
                    const dayTotal = getDayTotal(sortedDaySlots);
                    
                    return (
                      <div key={key} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Label className="text-sm font-medium">{label}</Label>
                            <Badge variant="secondary" className="text-xs">
                              {dayTotal.toFixed(2)}h total
                            </Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addWorkSlot(key)}
                            disabled={daySlots.length >= 6}
                            className="text-xs"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Slot
                          </Button>
                        </div>
                        
                        {daySlots.length === 0 ? (
                          <div className="p-3 border-2 border-dashed border-gray-200 rounded-lg text-center text-sm text-gray-500">
                            No work slots scheduled for {label.toLowerCase()}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {sortedDaySlots.map((slot, index) => (
                              <div key={slot.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-2 flex-1">
                                  <Select
                                    value={slot.startTime}
                                    onValueChange={(value) => updateWorkSlotHandler(key, slot.id, { startTime: value })}
                                  >
                                    <SelectTrigger className="w-20 h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {timeOptions.map(time => (
                                        <SelectItem key={time.value} value={time.value} className="text-xs">
                                          {time.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  
                                  <span className="text-xs text-gray-500">to</span>
                                  
                                  <Select
                                    value={slot.endTime}
                                    onValueChange={(value) => updateWorkSlotHandler(key, slot.id, { endTime: value })}
                                  >
                                    <SelectTrigger className="w-20 h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {timeOptions.map(time => (
                                        <SelectItem key={time.value} value={time.value} className="text-xs">
                                          {time.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  
                                  <Badge variant="outline" className="text-xs">
                                    {formatWorkSlotDurationDisplay(new Date(`1970-01-01T${slot.startTime}`), new Date(`1970-01-01T${slot.endTime}`))}
                                  </Badge>
                                </div>
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeWorkSlot(key, slot.id)}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Quick Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const standardWeek = generateDefaultWorkSchedule('standard');
                      updateSettings({ weeklyWorkHours: standardWeek });
                    }}
                  >
                    Standard (9-5 Mon-Fri)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const flexibleWeek = generateDefaultWorkSchedule('flexible');
                      updateSettings({ weeklyWorkHours: flexibleWeek });
                    }}
                  >
                    Split Schedule (AM/PM)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const flexibleWeek = generateDefaultWorkSchedule('minimal');
                      // Clear all by creating empty schedule
                      const emptyWeek = {
                        monday: [], tuesday: [], wednesday: [], thursday: [], 
                        friday: [], saturday: [], sunday: []
                      };
                      updateSettings({ weeklyWorkHours: emptyWeek });
                    }}
                  >
                    Clear All
                  </Button>
                </div>
                
                <div className="text-xs text-gray-500 space-y-1">
                  <p>• Add multiple work slots per day (up to 6 slots)</p>
                  <p>• Times can be set in 15-minute increments</p>
                  <p>• Total daily hours = sum of all slots for that day</p>
                  <p>• Timeline and availability calculations use your complete schedule</p>
                  <p>• Recommended: 6-8 hours per workday for sustainable productivity</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'groups':
        const MAX_GROUPS = 8;
        const canAddGroup = groups.length < MAX_GROUPS;
        
        const handleAddGroup = async () => {
          if (!newGroupName.trim()) {
            toast({
              title: "Error",
              description: "Group name cannot be empty",
              variant: "destructive",
            });
            return;
          }
          
          if (groups.length >= MAX_GROUPS) {
            toast({
              title: "Error",
              description: `Maximum of ${MAX_GROUPS} groups allowed`,
              variant: "destructive",
            });
            return;
          }
          
          try {
            await addGroup({ name: newGroupName.trim() });
            setNewGroupName('');
          } catch (error) {
            // Error is already handled by useGroups hook
          }
        };
        
        const handleStartEdit = (groupId: string, currentName: string) => {
          setEditingGroupId(groupId);
          setEditingGroupName(currentName);
        };
        
        const handleSaveEdit = async (groupId: string) => {
          if (!editingGroupName.trim()) {
            toast({
              title: "Error",
              description: "Group name cannot be empty",
              variant: "destructive",
            });
            return;
          }
          
          try {
            await updateGroup(groupId, { name: editingGroupName.trim() });
            setEditingGroupId(null);
            setEditingGroupName('');
          } catch (error) {
            // Error is already handled by useGroups hook
          }
        };
        
        const handleCancelEdit = () => {
          setEditingGroupId(null);
          setEditingGroupName('');
        };
        
        const handleDeleteGroup = async (groupId: string, groupName: string) => {
          if (!confirm(`Are you sure you want to delete the group "${groupName}"? This will affect all projects in this group.`)) {
            return;
          }
          
          try {
            await deleteGroup(groupId);
          } catch (error) {
            // Error is already handled by useGroups hook
          }
        };
        
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Groups</h2>
              <p className="text-sm text-gray-600">
                Organize your projects into groups. The first group is the default for new projects.
              </p>
            </div>
            
            <div className="space-y-4">
              {/* Add new group */}
              <div className="flex gap-2">
                <Input
                  placeholder="Enter group name..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddGroup()}
                  disabled={!canAddGroup}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddGroup}
                  disabled={!canAddGroup || !newGroupName.trim()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Group
                </Button>
              </div>
              
              {!canAddGroup && (
                <p className="text-sm text-amber-600">
                  Maximum of {MAX_GROUPS} groups reached
                </p>
              )}
              
              {/* Groups list */}
              <div className="space-y-2">
                {groupsLoading ? (
                  <div className="text-sm text-gray-500">Loading groups...</div>
                ) : groups.length === 0 ? (
                  <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg text-center text-sm text-gray-500">
                    No groups yet. Add your first group above.
                  </div>
                ) : (
                  groups.map((group, index) => (
                    <div
                      key={group.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border",
                        index === 0 
                          ? "bg-blue-50 border-blue-200" 
                          : "bg-gray-50 border-gray-200"
                      )}
                    >
                      {index === 0 && (
                        <Badge variant="default" className="bg-blue-600">
                          Default
                        </Badge>
                      )}
                      
                      {editingGroupId === group.id ? (
                        <>
                          <Input
                            value={editingGroupName}
                            onChange={(e) => setEditingGroupName(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(group.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className="flex-1"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(group.id)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <FolderKanban className="w-4 h-4 text-gray-500" />
                          <span className="flex-1 font-medium text-gray-900">
                            {group.name}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(group.id, group.name)}
                          >
                            Rename
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteGroup(group.id, group.name)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
              
              <div className="text-xs text-gray-500 space-y-1 pt-2">
                <p>• The first group in the list is the default for new projects</p>
                <p>• You can have up to {MAX_GROUPS} groups</p>
                <p>• Deleting a group will affect all projects assigned to it</p>
                <p>• Recommended default groups: "Work" and "Personal"</p>
              </div>
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Appearance</h2>
              <p className="text-sm text-gray-600">Customize the look and feel of the application</p>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Dark Mode</Label>
                <p className="text-sm text-gray-600">Enable dark theme for better viewing in low light</p>
              </div>
              <Switch
                checked={localSettings.darkMode}
                onCheckedChange={(checked) => handleSettingChange('darkMode', checked)}
              />
            </div>
          </div>
        );

      case 'time':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Time & Date</h2>
              <p className="text-sm text-gray-600">Configure time format and timezone preferences</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="time-format">Time Format</Label>
                <Select 
                  value={localSettings.timeFormat} 
                  onValueChange={(value) => handleSettingChange('timeFormat', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12-hour (2:30 PM)</SelectItem>
                    <SelectItem value="24h">24-hour (14:30)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select 
                  value={localSettings.timezone} 
                  onValueChange={(value) => handleSettingChange('timezone', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC-8">Pacific Time (UTC-8)</SelectItem>
                    <SelectItem value="UTC-5">Eastern Time (UTC-5)</SelectItem>
                    <SelectItem value="UTC-6">Central Time (UTC-6)</SelectItem>
                    <SelectItem value="UTC-7">Mountain Time (UTC-7)</SelectItem>
                    <SelectItem value="UTC+0">Greenwich Mean Time (UTC+0)</SelectItem>
                    <SelectItem value="UTC+1">Central European Time (UTC+1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Notifications</h2>
              <p className="text-sm text-gray-600">Manage how and when you receive notifications</p>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Push Notifications</Label>
                <p className="text-sm text-gray-600">Receive notifications in the app</p>
              </div>
              <Switch
                checked={localSettings.notifications}
                onCheckedChange={(checked) => handleSettingChange('notifications', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Email Notifications</Label>
                <p className="text-sm text-gray-600">Receive notifications via email</p>
              </div>
              <Switch
                checked={localSettings.emailNotifications}
                onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
              />
            </div>
          </div>
        );

      case 'calendar':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Calendar Integration</h2>
              <p className="text-sm text-gray-600">Import events from external calendars and calendar files</p>
            </div>
            
            <CalendarImport />
          </div>
        );

      case 'pwa':
        return <PWASettings />;

      case 'privacy':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Data & Privacy</h2>
              <p className="text-sm text-gray-600">Manage your data and privacy settings</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-amber-200 rounded-lg bg-amber-50">
                <div className="space-y-1">
                  <Label className="text-amber-900">Reset All Settings</Label>
                  <p className="text-sm text-amber-700">
                    This will restore all settings to their default values
                  </p>
                </div>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleResetSettings}
                  className="border-amber-300 hover:bg-amber-100"
                >
                  Reset to Defaults
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                <div className="space-y-1">
                  <Label className="text-red-900">Clear All Data</Label>
                  <p className="text-sm text-red-700">
                    This will permanently delete all your projects, events, and settings
                  </p>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleClearData}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Data
                </Button>
              </div>
            </div>

            <Separator />

            {/* Version Info */}
            <div className="space-y-2 text-sm text-gray-500">
              <p>Budgi Time Forecasting App</p>
              <p>Version 1.0.0 • Built with React & TypeScript</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AppPageLayout>
      {/* No header */}

      {/* Content - Card with sidebar and content area */}
      <AppPageLayout.Content className="flex-1 overflow-hidden p-8">
        <CardSidebarLayout
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          sidebarTitle="Settings"
          renderContent={renderTabContent}
        />
      </AppPageLayout.Content>
    </AppPageLayout>
  );
}