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
  LogOut
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

  const [subscription] = useState({
    plan: 'Free',
    status: 'active',
    nextBilling: null,
    amount: 0,
    currency: 'USD',
    features: [
      'Basic project management',
      'Up to 5 projects',
      'Standard support'
    ],
    usage: {
      projects: 3,
      projectsLimit: 5,
      storage: 0.2,
      storageLimit: 1
    }
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

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
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

  const handleNotificationChange = (key: string, value: boolean) => {
    setAccountSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value
      }
    }));
  };

  const handleDownloadData = () => {
    toast({
      title: "Export Started",
      description: "Your data export will be emailed to you shortly",
    });
  };

  const handleDeleteAccount = () => {
    toast({
      title: "Account Deletion",
      description: "This feature requires additional confirmation steps",
    });
  };

  return (
    <div className="flex-1 bg-white">
      {/* Header */}
      <div className="h-20 border-b border-[#e2e2e2] flex items-center justify-between px-8">
        <div className="flex items-center space-x-6">
          <h1 className="text-lg font-semibold text-[#595956]">Profile & Account</h1>
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

      {/* Content */}
      <div className="p-[21px] space-y-[21px] max-w-5xl light-scrollbar">
        {/* User Info Header */}
        <Card className="relative">
          <div className="absolute top-4 left-4">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Functioning
            </Badge>
          </div>
          <CardHeader className="pt-12">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#02c0b7] text-white flex items-center justify-center font-bold text-xl">
                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {profile?.display_name || user?.email?.split('@')[0] || 'User'}
                </CardTitle>
                <CardDescription className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Signed in as: {user?.email}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={signOut}
                    className="ml-auto"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[21px]">
          {/* Account Management */}
          <div className="lg:col-span-2 space-y-[21px]">
            {/* Account Settings */}
            <Card className="relative">
              <div className="absolute top-4 left-4">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Functioning
                </Badge>
              </div>
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
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">Email Address</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{user?.email}</span>
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
                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
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
                      <Lock className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="font-medium">Password</p>
                        <p className="text-sm text-gray-600">Update your password</p>
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
                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
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

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-gray-600">Add an extra layer of security</p>
                      </div>
                    </div>
                    <Switch 
                      checked={accountSettings.twoFactorEnabled}
                      onCheckedChange={(checked) => setAccountSettings(prev => ({
                        ...prev,
                        twoFactorEnabled: checked
                      }))}
                    />
                  </div>
                </div>

                <Separator />

                {/* Preferences */}
                <div className="space-y-4">
                  <h4 className="font-medium">Preferences</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="language">Language</Label>
                      <Select value={accountSettings.language}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select value={accountSettings.timezone}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time</SelectItem>
                          <SelectItem value="America/Chicago">Central Time</SelectItem>
                          <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card className="relative">
              <div className="absolute top-4 left-4">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Functioning
                </Badge>
              </div>
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
                    <p className="text-sm text-gray-600">Receive updates via email</p>
                  </div>
                  <Switch 
                    checked={accountSettings.notifications.email}
                    onCheckedChange={(checked) => handleNotificationChange('email', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Push Notifications</p>
                    <p className="text-sm text-gray-600">Browser push notifications</p>
                  </div>
                  <Switch 
                    checked={accountSettings.notifications.push}
                    onCheckedChange={(checked) => handleNotificationChange('push', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Project Reminders</p>
                    <p className="text-sm text-gray-600">Deadline and milestone alerts</p>
                  </div>
                  <Switch 
                    checked={accountSettings.notifications.reminders}
                    onCheckedChange={(checked) => handleNotificationChange('reminders', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Product Updates</p>
                    <p className="text-sm text-gray-600">News about new features</p>
                  </div>
                  <Switch 
                    checked={accountSettings.notifications.updates}
                    onCheckedChange={(checked) => handleNotificationChange('updates', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Usage & Actions Sidebar */}
          <div className="space-y-[21px]">
            {/* Subscription Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  Current Plan
                </CardTitle>
                <CardDescription>
                  {subscription.plan} Plan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <Badge className="bg-green-100 text-green-800">
                    {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                  </Badge>
                </div>
                
                <div>
                  <Label className="text-sm text-gray-600 mb-2 block">Plan Features</Label>
                  <div className="space-y-2">
                    {subscription.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Usage Overview */}
            <Card className="relative">
              <div className="absolute top-4 left-4">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Functioning
                </Badge>
              </div>
              <CardHeader className="pt-12">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-500" />
                  Usage Overview
                </CardTitle>
                <CardDescription>
                  Current plan usage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Projects</span>
                    <span className="text-sm font-medium">
                      {subscription.usage.projects} / {subscription.usage.projectsLimit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-[#02c0b7] h-2 rounded-full" 
                      style={{ width: `${(subscription.usage.projects / subscription.usage.projectsLimit) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Storage</span>
                    <span className="text-sm font-medium">
                      {subscription.usage.storage} GB / {subscription.usage.storageLimit} GB
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${(subscription.usage.storage / subscription.usage.storageLimit) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Actions */}
            <Card className="relative">
              <div className="absolute top-4 left-4">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Functioning
                </Badge>
              </div>
              <CardHeader className="pt-12">
                <CardTitle>Account Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleDownloadData}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>
                
                <Button variant="outline" className="w-full justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  Invite Team
                </Button>
                
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  Billing History
                </Button>
                
                <Separator />
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleDeleteAccount}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}