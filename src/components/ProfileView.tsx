import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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
  Settings
} from 'lucide-react';

export function ProfileView() {
  const [accountSettings, setAccountSettings] = useState({
    email: 'alex.johnson@example.com',
    emailVerified: true,
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
    plan: 'Professional',
    status: 'active',
    nextBilling: '2024-09-15',
    amount: 29.99,
    currency: 'USD',
    features: [
      'Unlimited projects',
      'Advanced analytics',
      'Team collaboration',
      'Priority support',
      'Data export'
    ],
    usage: {
      projects: 12,
      projectsLimit: 'unlimited',
      storage: 2.4,
      storageLimit: 100
    }
  });

  const handleNotificationChange = (key: string, value: boolean) => {
    setAccountSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value
      }
    }));
  };

  const handleCancelSubscription = () => {
    console.log('Cancel subscription requested');
  };

  const handleDownloadData = () => {
    console.log('Download data requested');
  };

  const handleDeleteAccount = () => {
    console.log('Delete account requested');
  };

  return (
    <div className="flex-1 bg-white">
      {/* Header */}
      <div className="h-20 border-b border-[#e2e2e2] flex items-center justify-between px-8">
        <div className="flex items-center space-x-6">
          <h1 className="text-lg font-semibold text-[#595956]">Account</h1>
          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
            {subscription.plan} Plan
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <ExternalLink className="w-4 h-4 mr-2" />
            Billing Portal
          </Button>
          <Button className="bg-[#02c0b7] hover:bg-[#02a09a] text-white">
            <Crown className="w-4 h-4 mr-2" />
            Upgrade Plan
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-[21px] space-y-[21px] max-w-5xl light-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[21px]">
          {/* Account Management */}
          <div className="lg:col-span-2 space-y-[21px]">
            {/* Subscription Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  Subscription Details
                </CardTitle>
                <CardDescription>
                  Manage your subscription and billing information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{subscription.plan} Plan</h4>
                    <p className="text-sm text-gray-600">
                      ${subscription.amount}/{subscription.currency === 'USD' ? 'month' : 'mo'}
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                  </Badge>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-600">Next Billing Date</Label>
                    <p className="font-medium">{new Date(subscription.nextBilling).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Billing Amount</Label>
                    <p className="font-medium">${subscription.amount} USD</p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-gray-600 mb-2 block">Plan Features</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {subscription.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" size="sm">
                    Change Plan
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCancelSubscription}>
                    Cancel Subscription
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Account Settings */}
            <Card>
              <CardHeader>
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
                      <span className="text-sm text-gray-600">{accountSettings.email}</span>
                      {accountSettings.emailVerified && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Verified
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Change Email
                  </Button>
                </div>

                <Separator />

                {/* Security Settings */}
                <div className="space-y-4">
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
                  <Button variant="outline" size="sm">
                    Change Password
                  </Button>
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
            <Card>
              <CardHeader>
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
            {/* Usage Overview */}
            <Card>
              <CardHeader>
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
                      style={{ width: '40%' }}
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

            {/* Billing Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-500" />
                  Billing Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Payment Method</span>
                  <span className="text-sm font-medium">•••• 4242</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Next Payment</span>
                  <span className="text-sm font-medium">${subscription.amount}</span>
                </div>

                <Button variant="outline" size="sm" className="w-full">
                  Update Payment Method
                </Button>
              </CardContent>
            </Card>

            {/* Account Actions */}
            <Card>
              <CardHeader>
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

            {/* Warning Card */}
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-900 mb-1">
                      Subscription Renewal
                    </h4>
                    <p className="text-sm text-amber-800">
                      Your subscription will renew automatically on {new Date(subscription.nextBilling).toLocaleDateString()}.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}