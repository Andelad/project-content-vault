import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';

import { Save, Bell, Palette, Clock, Globe, Shield, Trash2, User, Plus, X, Calendar } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { WorkSlot } from '../contexts/AppContext';
import { CalendarImport } from './CalendarImport';
import { useToast } from '../hooks/use-toast';

export function SettingsView() {
  const { settings: appSettings, updateSettings } = useApp();
  const { toast } = useToast();
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
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    
    // If defaultView is being changed, immediately apply it
    if (key === 'defaultView') {
      // setDefaultView is not available, we'll just update settings
      
      // Save to localStorage (until database migration is available)
      try {
        await updateSettings({ defaultView: value });
        
        const viewDisplayName = value === 'timeline-weeks' ? 'Timeline (weeks)' : 
                               value === 'timeline' ? 'Timeline (days)' :
                               value === 'projects' ? 'Projects' : 
                               value === 'calendar' ? 'Calendar' : value;
        
        toast({
          title: "Default view updated",
          description: `Your default view has been set to ${viewDisplayName}`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save default view setting",
          variant: "destructive",
        });
      }
    }
  };

  // Helper functions for work slots
  const calculateDuration = (startTime: string, endTime: string): number => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    return Math.max(0, (endMinutes - startMinutes) / 60);
  };

  const generateTimeOptions = (): string[] => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const getDayTotal = (slots: WorkSlot[]): number => {
    return slots.reduce((total, slot) => total + slot.duration, 0);
  };

  const getWeekTotal = (): number => {
    return Object.values(appSettings.weeklyWorkHours).reduce((total, daySlots) => {
      return total + getDayTotal(daySlots);
    }, 0);
  };

  const addWorkSlot = (day: string) => {
    const daySlots = appSettings.weeklyWorkHours[day as keyof typeof appSettings.weeklyWorkHours] || [];
    if (daySlots.length >= 6) return; // Max 6 slots per day

    const newSlot: WorkSlot = {
      id: Date.now().toString(),
      startTime: '09:00',
      endTime: '10:00',
      duration: 1
    };

    updateSettings({
      weeklyWorkHours: {
        ...appSettings.weeklyWorkHours,
        [day]: [...daySlots, newSlot]
      }
    });
  };

  const updateWorkSlot = (day: string, slotId: string, updates: Partial<WorkSlot>) => {
    const daySlots = appSettings.weeklyWorkHours[day as keyof typeof appSettings.weeklyWorkHours] || [];
    const updatedSlots = daySlots.map(slot => {
      if (slot.id === slotId) {
        const updatedSlot = { ...slot, ...updates };
        // Recalculate duration if start or end time changed
        if (updates.startTime || updates.endTime) {
          updatedSlot.duration = calculateDuration(updatedSlot.startTime, updatedSlot.endTime);
        }
        return updatedSlot;
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
    try {
      // Save any remaining settings
      await updateSettings({
        defaultView: localSettings.defaultView,
        // Add other settings here as they're implemented
      });
      
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Settings applied locally",
        description: "Changes applied in current session (database save pending).",
      });
    }
    
    console.log('Settings saved:', localSettings, 'App settings:', appSettings);
  };

  const handleResetSettings = () => {
    setLocalSettings({
      notifications: true,
      emailNotifications: false,
      darkMode: false,
      timeFormat: '12h',
      timezone: 'UTC-8',
      language: 'en',
      autoSave: true,
      defaultView: 'projects'
    });
    updateSettings({
      weeklyWorkHours: {
        monday: [{ id: '1', startTime: '09:00', endTime: '17:00', duration: 8 }],
        tuesday: [{ id: '2', startTime: '09:00', endTime: '17:00', duration: 8 }],
        wednesday: [
          { id: '3a', startTime: '09:00', endTime: '13:00', duration: 4 },
          { id: '3b', startTime: '14:00', endTime: '18:00', duration: 4 }
        ],
        thursday: [{ id: '4', startTime: '09:00', endTime: '17:00', duration: 8 }],
        friday: [{ id: '5', startTime: '09:00', endTime: '17:00', duration: 8 }],
        saturday: [],
        sunday: []
      }
    });
  };

  const handleClearData = () => {
    // Implementation for clearing app data
    if (confirm('Are you sure you want to clear all app data? This action cannot be undone.')) {
      console.log('Clearing app data...');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#f9f9f9]">
      {/* Header */}
      <div className="h-20 border-b border-[#e2e2e2] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center space-x-6">
          <h1 className="text-lg font-semibold text-[#595956]">Settings</h1>
          <Badge variant="secondary">
            Preferences & Configuration
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleResetSettings}>
            Reset to Defaults
          </Button>
          <Button 
            className="bg-[#02c0b7] hover:bg-[#02a09a] text-white"
            onClick={handleSaveSettings}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-auto light-scrollbar">
        <div className="p-8 space-y-8 max-w-4xl">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              General
            </CardTitle>
            <CardDescription>
              Basic application preferences and display settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
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
          </CardContent>
        </Card>

        {/* Work Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Work Preferences
            </CardTitle>
            <CardDescription>
              Configure your daily work schedule and time allocation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                    {getWeekTotal().toFixed(2)} hours
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
                                    onValueChange={(value) => updateWorkSlot(key, slot.id, { startTime: value })}
                                  >
                                    <SelectTrigger className="w-20 h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {timeOptions.map(time => (
                                        <SelectItem key={time} value={time} className="text-xs">
                                          {time}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  
                                  <span className="text-xs text-gray-500">to</span>
                                  
                                  <Select
                                    value={slot.endTime}
                                    onValueChange={(value) => updateWorkSlot(key, slot.id, { endTime: value })}
                                  >
                                    <SelectTrigger className="w-20 h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {timeOptions.map(time => (
                                        <SelectItem key={time} value={time} className="text-xs">
                                          {time}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  
                                  <Badge variant="outline" className="text-xs">
                                    {slot.duration < 1 
                                      ? `${Math.round(slot.duration * 60)} min`
                                      : slot.duration === 1 
                                      ? '1 hour' 
                                      : `${slot.duration.toFixed(2)} hours`
                                    }
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
                      const standardWeek = {
                        monday: [{ id: 'm1', startTime: '09:00', endTime: '17:00', duration: 8 }],
                        tuesday: [{ id: 't1', startTime: '09:00', endTime: '17:00', duration: 8 }],
                        wednesday: [{ id: 'w1', startTime: '09:00', endTime: '17:00', duration: 8 }],
                        thursday: [{ id: 'th1', startTime: '09:00', endTime: '17:00', duration: 8 }],
                        friday: [{ id: 'f1', startTime: '09:00', endTime: '17:00', duration: 8 }],
                        saturday: [],
                        sunday: []
                      };
                      updateSettings({ weeklyWorkHours: standardWeek });
                    }}
                  >
                    Standard (9-5 Mon-Fri)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const splitWeek = {
                        monday: [
                          { id: 'm1', startTime: '09:00', endTime: '13:00', duration: 4 },
                          { id: 'm2', startTime: '14:00', endTime: '18:00', duration: 4 }
                        ],
                        tuesday: [
                          { id: 't1', startTime: '09:00', endTime: '13:00', duration: 4 },
                          { id: 't2', startTime: '14:00', endTime: '18:00', duration: 4 }
                        ],
                        wednesday: [
                          { id: 'w1', startTime: '09:00', endTime: '13:00', duration: 4 },
                          { id: 'w2', startTime: '14:00', endTime: '18:00', duration: 4 }
                        ],
                        thursday: [
                          { id: 'th1', startTime: '09:00', endTime: '13:00', duration: 4 },
                          { id: 'th2', startTime: '14:00', endTime: '18:00', duration: 4 }
                        ],
                        friday: [
                          { id: 'f1', startTime: '09:00', endTime: '13:00', duration: 4 },
                          { id: 'f2', startTime: '14:00', endTime: '18:00', duration: 4 }
                        ],
                        saturday: [],
                        sunday: []
                      };
                      updateSettings({ weeklyWorkHours: splitWeek });
                    }}
                  >
                    Split Schedule (AM/PM)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const clearWeek = {
                        monday: [], tuesday: [], wednesday: [], thursday: [], 
                        friday: [], saturday: [], sunday: []
                      };
                      updateSettings({ weeklyWorkHours: clearWeek });
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
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize the look and feel of the application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
          </CardContent>
        </Card>

        {/* Time & Date Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Time & Date
            </CardTitle>
            <CardDescription>
              Configure time format and timezone preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
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
          </CardContent>
        </Card>

        {/* Notifications Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Manage how and when you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
          </CardContent>
        </Card>

        {/* Calendar Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Calendar Integration
            </CardTitle>
            <CardDescription>
              Import events from external calendars and calendar files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CalendarImport />
          </CardContent>
        </Card>

        {/* Data & Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Data & Privacy
            </CardTitle>
            <CardDescription>
              Manage your data and privacy settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
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
          </CardContent>
        </Card>

        <Separator />

        {/* Version Info */}
        <div className="text-center space-y-2 text-sm text-gray-500">
          <p>Budgi Time Forecasting App</p>
          <p>Version 1.0.0 • Built with React & TypeScript</p>
        </div>
        </div>
      </div>
    </div>
  );
}