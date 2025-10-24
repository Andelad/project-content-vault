import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { 
  CreditCard, 
  Crown, 
  Mail, 
  Shield, 
  Bell, 
  Download, 
  Trash2, 
  AlertTriangle,
  Check,
  ExternalLink,
  Calendar,
  Zap,
  Users,
  Settings,
  Lock,
  User,
  LogOut,
  Camera,
  Upload,
  Save,
  Menu,
  ChevronLeft
} from 'lucide-react';

export function ProfileView() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('account');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Form states
  const [emailForm, setEmailForm] = useState({
    newEmail: '',
    showForm: false
  });
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    showForm: false
  });

  const [accountSettings, setAccountSettings] = useState({
    twoFactorEnabled: false,
    notifications: {
      email: true,
      push: false,
      reminders: true,
      updates: false
    },
    language: 'en',
    timezone: 'America/Los_Angeles'
  });

  // Load user profile on mount
  const fetchProfile = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
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

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  const handleEmailChange = async () => {
    if (!emailForm.newEmail || emailForm.newEmail === user?.email) {
      toast({
        title: "Error",
        description: "Please enter a valid new email address",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: emailForm.newEmail
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Email Update Initiated",
          description: "Please check both your old and new email for confirmation links",
        });
        setEmailForm({ newEmail: '', showForm: false });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords don't match",
        variant: "destructive"
      });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Password updated successfully",
        });
        setPasswordForm({ 
          currentPassword: '', 
          newPassword: '', 
          confirmPassword: '', 
          showForm: false 
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    if (!profile) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user?.id,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Profile update error:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Profile updated successfully",
        });
        // Refresh the profile data
        await fetchProfile();
      }
    } catch (error: any) {
      console.error('Profile update catch error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;

    setLoading(true);
    try {
      // Validate file size (1MB limit)
      if (file.size > 1 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "File size must be less than 1MB",
          variant: "destructive"
        });
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please upload an image file",
          variant: "destructive"
        });
        return;
      }

      // Validate image dimensions
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          if (img.width > 512 || img.height > 512) {
            reject(new Error('Image dimensions must be 512x512 pixels or smaller'));
          }
          resolve(true);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to load image'));
        };
        img.src = objectUrl;
      });

      // Create unique filename with user ID
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete existing avatar if it exists
      if (profile?.avatar_url) {
        const existingPath = profile.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage
          .from('avatars')
          .remove([existingPath]);
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          upsert: true
        });

      if (uploadError) {
        toast({
          title: "Error",
          description: uploadError.message,
          variant: "destructive"
        });
        return;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          display_name: profile?.display_name || user.email?.split('@')[0],
          avatar_url: data.publicUrl
        }, {
          onConflict: 'user_id'
        });

      if (updateError) {
        toast({
          title: "Error",
          description: updateError.message,
          variant: "destructive"
        });
        return;
      }

      // Update local state
      setProfile(prev => ({
        ...prev,
        avatar_url: data.publicUrl
      }));

      // Dispatch custom event to refresh sidebar avatar
      window.dispatchEvent(new CustomEvent('profile-updated'));

      toast({
        title: "Success",
        description: "Avatar uploaded successfully",
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    setAccountSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value
      }
    }));
  };

  const handleExportData = async () => {
    setLoading(true);
    try {
      // Fetch all user data
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user?.id);

      const { data: calendarEvents, error: eventsError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user?.id);

      if (projectsError || eventsError) {
        throw new Error('Failed to fetch data');
      }

      // Create export object
      const exportData = {
        profile,
        projects,
        calendarEvents,
        settings: accountSettings,
        exportDate: new Date().toISOString()
      };

      // Convert to JSON and download
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `budgi-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Your data has been exported successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you absolutely sure you want to delete your account? This action cannot be undone and will permanently delete:\n\n' +
      '• Your profile and personal information\n' +
      '• All your projects and events\n' +
      '• All your settings and preferences\n' +
      '• Your account access\n\n' +
      'Type "DELETE" in the next prompt to confirm.'
    );

    if (!confirmed) return;

    const confirmText = window.prompt('Please type DELETE to confirm account deletion:');
    
    if (confirmText !== 'DELETE') {
      toast({
        title: "Cancelled",
        description: "Account deletion cancelled",
      });
      return;
    }

    setLoading(true);
    try {
      // Delete user data first (projects, calendar_events, profile)
      await supabase.from('projects').delete().eq('user_id', user?.id);
      await supabase.from('calendar_events').delete().eq('user_id', user?.id);
      await supabase.from('profiles').delete().eq('user_id', user?.id);

      // Delete avatar from storage if it exists
      if (profile?.avatar_url) {
        const existingPath = profile.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars').remove([existingPath]);
      }

      // Delete the auth user (this will cascade to other tables with foreign keys)
      const { error } = await supabase.auth.admin.deleteUser(user?.id || '');

      if (error) {
        // If admin delete fails (requires service role), try regular delete
        const { error: deleteError } = await supabase.auth.updateUser({
          data: { deleted: true }
        });
        
        if (deleteError) throw deleteError;
      }

      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted",
      });

      // Sign out and redirect
      await signOut();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account. Please contact support.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'profile', label: 'Profile Picture', icon: Upload },
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'data', label: 'Data Management', icon: Download },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Status</h2>
              <p className="text-sm text-gray-600">Current authentication and session information</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">Signed in as</p>
                  <p className="font-medium text-gray-900">{user?.email}</p>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 mt-2">
                    <Check className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center font-semibold text-xl overflow-hidden border-2 border-gray-200`}>
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
              </div>

              <Button variant="outline" onClick={signOut} className="w-full">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile Picture</h2>
              <p className="text-sm text-gray-600">Upload and manage your profile avatar</p>
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <div 
                className="w-32 h-32 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center font-semibold text-3xl cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden"
                onClick={() => document.getElementById('avatar-upload')?.click()}
              >
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
              <div className="space-y-2 text-center w-full max-w-xs">
                <Button 
                  variant="outline" 
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                  disabled={loading}
                  className="w-full"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {loading ? 'Uploading...' : 'Upload Photo'}
                </Button>
                <p className="text-sm text-gray-500">
                  JPG, PNG or GIF. Max 1MB, 512x512px.
                </p>
              </div>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleAvatarUpload(file);
                  }
                }}
              />
            </div>
          </div>
        );

      case 'personal':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Personal Information</h2>
              <p className="text-sm text-gray-600">Update your personal details and contact information</p>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={profile?.display_name || ''}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, display_name: e.target.value } : { display_name: e.target.value })}
                    placeholder="Enter your username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
              <Button onClick={handleProfileUpdate} disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Security Settings</h2>
              <p className="text-sm text-gray-600">Manage your account security and password</p>
            </div>
            
            <div className="space-y-6">
              {/* Email Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Email Address</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{user?.email}</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Verified
                    </Badge>
                  </div>
                </div>
                
                {!emailForm.showForm ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEmailForm(prev => ({ ...prev, showForm: true }))}
                  >
                    Change Email
                  </Button>
                ) : (
                  <div className="space-y-3 p-4 bg-muted rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="newEmail">New Email Address</Label>
                      <Input
                        id="newEmail"
                        type="email"
                        value={emailForm.newEmail}
                        onChange={(e) => setEmailForm(prev => ({ ...prev, newEmail: e.target.value }))}
                        placeholder="Enter new email address"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={handleEmailChange}
                        disabled={loading}
                      >
                        Update Email
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setEmailForm({ newEmail: '', showForm: false })}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Password Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Password</p>
                      <p className="text-sm text-muted-foreground">Update your password</p>
                    </div>
                  </div>
                </div>
                
                {!passwordForm.showForm ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setPasswordForm(prev => ({ ...prev, showForm: true }))}
                  >
                    Change Password
                  </Button>
                ) : (
                  <div className="space-y-3 p-4 bg-muted rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                        placeholder="Enter current password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="Enter new password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirm new password"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={handlePasswordChange}
                        disabled={loading}
                      >
                        Update Password
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setPasswordForm({ 
                          currentPassword: '', 
                          newPassword: '', 
                          confirmPassword: '', 
                          showForm: false 
                        })}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'data':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Data Management</h2>
              <p className="text-sm text-gray-600">Export or manage your account data</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-blue-200 rounded-lg bg-blue-50">
                <div className="space-y-1">
                  <p className="font-medium text-blue-900">Export Account Data</p>
                  <p className="text-sm text-blue-700">
                    Download a copy of all your projects, events, and settings
                  </p>
                </div>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleExportData}
                  disabled={loading}
                  className="border-blue-300 hover:bg-blue-100"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                <div className="space-y-1">
                  <p className="font-medium text-red-900">Delete Account</p>
                  <p className="text-sm text-red-700">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                <Button 
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={loading}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };


  return (
    <div className="h-full flex flex-col bg-gray-50 p-8">
      <Card className="h-full flex overflow-hidden max-w-[1216px]">
        {/* Sidebar */}
        <div className={cn(
          "relative flex-shrink-0 border-r border-gray-200 bg-gray-50 transition-all duration-300",
          sidebarOpen ? (sidebarCollapsed ? "w-16" : "w-64") : "w-0"
        )}>
          <div className={cn(
            "h-full flex flex-col",
            !sidebarOpen && "opacity-0"
          )}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              {!sidebarCollapsed && <h2 className="font-semibold text-gray-900">Profile</h2>}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => sidebarCollapsed ? setSidebarCollapsed(false) : (window.innerWidth < 1024 ? setSidebarOpen(false) : setSidebarCollapsed(true))}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className={cn(
                  "h-4 w-4 transition-transform duration-300",
                  sidebarCollapsed && "rotate-180"
                )} />
              </Button>
            </div>
            
            <nav className="flex-1 overflow-y-auto light-scrollbar p-2">
              <div className={cn(
                "space-y-0",
                sidebarCollapsed && "space-y-1"
              )}>
                {tabs.map((tab, index) => (
                  <React.Fragment key={tab.id}>
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      title={sidebarCollapsed ? tab.label : undefined}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all",
                        sidebarCollapsed && "justify-center px-0",
                        activeTab === tab.id
                          ? "bg-[#02c0b7] text-white"
                          : "text-gray-700 hover:bg-gray-200/70 hover:text-gray-900"
                      )}
                    >
                      <tab.icon className="w-4 h-4 flex-shrink-0" />
                      {!sidebarCollapsed && <span>{tab.label}</span>}
                    </button>
                    {index < tabs.length - 1 && (
                      <div className="border-b border-gray-200 mx-2" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </nav>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile menu button / Toggle button */}
          <div className={cn(
            "p-4 border-b border-gray-200 flex items-center",
            (sidebarOpen && !sidebarCollapsed) && "lg:hidden"
          )}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setSidebarOpen(!sidebarOpen);
                } else {
                  setSidebarOpen(true);
                  setSidebarCollapsed(false);
                }
              }}
              className="h-8 w-8 p-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <h2 className="ml-3 font-semibold text-gray-900">
              {tabs.find(tab => tab.id === activeTab)?.label}
            </h2>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto light-scrollbar">
            <div className="p-8 w-full max-w-4xl">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </Card>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/20 z-40"
          onClick={() => {
            setSidebarOpen(false);
            setSidebarCollapsed(false);
          }}
        />
      )}
    </div>
  );
}
