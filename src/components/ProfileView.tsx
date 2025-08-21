import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
  Save
} from 'lucide-react';

export function ProfileView() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
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
  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
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
  };

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
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "File size must be less than 5MB",
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

  return (
    <div className="h-full flex flex-col bg-[#f9f9f9]">
      {/* Header */}
      <div className="h-20 border-b border-[#e2e2e2] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center space-x-6">
          <h1 className="text-lg font-semibold text-[#595956]">Profile</h1>
          <Badge variant="secondary">
            Account Management
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <ExternalLink className="w-4 h-4 mr-2" />
            Help Center
          </Button>
          <Button className="bg-[#02c0b7] hover:bg-[#02a09a] text-white">
            <Crown className="w-4 h-4 mr-2" />
            Upgrade Plan
          </Button>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-auto light-scrollbar">
        <div className="p-8 space-y-8 max-w-4xl">
          {/* Account Status Card */}
          <Card className="relative">
            <Badge className="absolute top-4 left-4 bg-green-100 text-green-800 border-green-200">
              Functioning
            </Badge>
            <CardHeader className="pt-12">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Account Status
              </CardTitle>
              <CardDescription>
                Current authentication and session information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Signed in as {user?.email}
                </div>
                <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Profile Picture Card */}
          <Card className="relative">
            <Badge className="absolute top-4 left-4 bg-green-100 text-green-800 border-green-200">
              Functioning
            </Badge>
            <CardHeader className="pt-12">
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Profile Picture
              </CardTitle>
              <CardDescription>
                Upload and manage your profile avatar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div 
                  className="w-24 h-24 rounded-full border-2 border-dashed border-[#e2e2e2] flex items-center justify-center font-semibold text-2xl cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden"
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
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                    disabled={loading}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {loading ? 'Uploading...' : 'Upload Photo'}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    JPG, PNG or GIF. Max file size 5MB.
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
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card className="relative">
            <Badge className="absolute top-4 left-4 bg-green-100 text-green-800 border-green-200">
              Functioning
            </Badge>
            <CardHeader className="pt-12">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Update your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
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
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card className="relative">
            <Badge className="absolute top-4 left-4 bg-green-100 text-green-800 border-green-200">
              Functioning
            </Badge>
            <CardHeader className="pt-12">
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Account Settings
              </CardTitle>
              <CardDescription>
                Manage your account preferences and security
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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

              {/* Security Settings */}
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
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="relative">
            <Badge className="absolute top-4 left-4 bg-green-100 text-green-800 border-green-200">
              Functioning
            </Badge>
            <CardHeader className="pt-12">
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Configure how you receive updates and reminders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch 
                  checked={accountSettings.notifications.email}
                  onCheckedChange={(checked) => handleNotificationChange('email', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Browser push notifications</p>
                </div>
                <Switch 
                  checked={accountSettings.notifications.push}
                  onCheckedChange={(checked) => handleNotificationChange('push', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Project Reminders</p>
                  <p className="text-sm text-muted-foreground">Deadline and milestone alerts</p>
                </div>
                <Switch 
                  checked={accountSettings.notifications.reminders}
                  onCheckedChange={(checked) => handleNotificationChange('reminders', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}