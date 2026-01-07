import React from 'react';
import { Button } from '@/components/shadcn/button';
import { Label } from '@/components/shadcn/label';
import { Badge } from '@/components/shadcn/badge';
import { Download, Check, Smartphone } from 'lucide-react';
import { usePWAInstall } from '@/hooks/ui/usePWAInstall';
import { useToast } from '@/hooks/ui/use-toast';

export function PWASettings() {
  const { isInstalled, isInstallable, install } = usePWAInstall();
  const { toast } = useToast();

  const handleInstall = async () => {
    const result = await install();
    
    if (result.success) {
      toast({
        title: "Installation started",
        description: "The app is being installed on your device",
      });
    } else if (result.outcome === 'dismissed') {
      toast({
        title: "Installation cancelled",
        description: "You can install the app anytime from this page",
      });
    } else {
      toast({
        title: "Installation not available",
        description: "Your browser doesn't support app installation or the app is already installed",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Progressive Web App</h2>
        <p className="text-sm text-gray-600">Install this app on your device for quick access and offline functionality</p>
      </div>

      <div className="space-y-4">
        {/* Installation Status */}
        <div className="p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base">Installation Status</Label>
            {isInstalled ? (
              <Badge variant="default" className="bg-green-600">
                <Check className="w-3 h-3 mr-1" />
                Installed
              </Badge>
            ) : isInstallable ? (
              <Badge variant="default" className="bg-blue-600">
                Available
              </Badge>
            ) : (
              <Badge variant="secondary">
                Not Available
              </Badge>
            )}
          </div>
          
          {isInstalled ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                ✅ The app is installed on your device
              </p>
              <p className="text-xs text-gray-500">
                You can access it from your home screen or app launcher
              </p>
            </div>
          ) : isInstallable ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Install this app for a native-like experience with offline support
              </p>
              <Button 
                onClick={handleInstall}
                className="w-full sm:w-auto"
              >
                <Download className="w-4 h-4 mr-2" />
                Install App
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Installation is not currently available on this device
              </p>
              <p className="text-xs text-gray-500">
                This may be because the app is already installed, or your browser doesn't support installation
              </p>
            </div>
          )}
        </div>

        {/* Benefits Section */}
        <div className="space-y-3">
          <Label className="text-base">Benefits of Installing</Label>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span><strong>Quick Access:</strong> Launch directly from your home screen</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span><strong>Offline Support:</strong> Access your data even without internet</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span><strong>Native Experience:</strong> Runs like a native app on your device</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span><strong>Fast Loading:</strong> Instant startup with cached resources</span>
            </li>
          </ul>
        </div>

        {/* Platform-specific instructions */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Smartphone className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-900 space-y-1">
              <p className="font-medium">Alternative Installation Methods:</p>
              <p><strong>Chrome/Edge Desktop:</strong> Look for the install icon in the address bar</p>
              <p><strong>Safari iOS:</strong> Tap Share → Add to Home Screen</p>
              <p><strong>Chrome Android:</strong> Tap menu → Install app</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
