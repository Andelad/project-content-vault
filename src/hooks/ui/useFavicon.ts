import { useEffect } from 'react';

const createSVGFavicon = (svg: string): string => {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  return URL.createObjectURL(blob);
};

const DEFAULT_FAVICON = '/favicon.ico';

const RECORD_FAVICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <radialGradient id="recordGradient" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#ff4444;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#cc0000;stop-opacity:1" />
    </radialGradient>
  </defs>
  <circle cx="16" cy="16" r="14" fill="url(#recordGradient)" stroke="#990000" stroke-width="1"/>
  <circle cx="16" cy="16" r="4" fill="#660000"/>
</svg>
`;

export const useFavicon = (isRecording: boolean = false) => {
  useEffect(() => {
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    
    if (!link) {
      // Create favicon link if it doesn't exist
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.type = 'image/x-icon';
      document.head.appendChild(newLink);
    }
    
    const faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    
    if (isRecording) {
      // Switch to record symbol
      const recordFaviconUrl = createSVGFavicon(RECORD_FAVICON_SVG);
      faviconLink.href = recordFaviconUrl;
      faviconLink.type = 'image/svg+xml';
      
      // Cleanup function to revoke the object URL when not recording
      return () => {
        URL.revokeObjectURL(recordFaviconUrl);
      };
    } else {
      // Switch back to default favicon
      faviconLink.href = DEFAULT_FAVICON;
      faviconLink.type = 'image/x-icon';
    }
  }, [isRecording]);
};
