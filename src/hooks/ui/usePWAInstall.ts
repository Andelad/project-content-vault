import { useState, useEffect } from 'react';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkInstalled = () => {
      const nav = window.navigator as Navigator & { standalone?: boolean };
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
        || nav.standalone 
        || document.referrer.includes('android-app://');
      
      setIsInstalled(isStandalone);
    };

    checkInstalled();

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setIsInstallable(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<{ success: boolean; outcome?: string }> => {
    if (!installPrompt) {
      return { success: false };
    }

    try {
      await installPrompt.prompt();
      const choiceResult = await installPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        setInstallPrompt(null);
        setIsInstallable(false);
        return { success: true, outcome: 'accepted' };
      }
      
      return { success: false, outcome: 'dismissed' };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'usePWAInstall', action: 'Error during PWA installation:' });
      return { success: false };
    }
  };

  return {
    isInstalled,
    isInstallable,
    install
  };
}
