// Simple test to verify favicon functionality
// This can be run in the browser console to test the hook manually

const testFaviconChanges = () => {
  console.log('Testing favicon changes...');
  
  // Get current favicon
  const currentFavicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
  console.log('Current favicon:', currentFavicon?.href);
  
  // Create a test SVG favicon
  const testSVG = `
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
  
  // Test changing to record symbol
  const blob = new Blob([testSVG], { type: 'image/svg+xml' });
  const recordFaviconUrl = URL.createObjectURL(blob);
  
  if (currentFavicon) {
    console.log('Changing to record symbol...');
    currentFavicon.href = recordFaviconUrl;
    currentFavicon.type = 'image/svg+xml';
    
    // Revert after 3 seconds
    setTimeout(() => {
      console.log('Reverting to default favicon...');
      currentFavicon.href = '/favicon.ico';
      currentFavicon.type = 'image/x-icon';
      URL.revokeObjectURL(recordFaviconUrl);
      console.log('Test completed!');
    }, 3000);
  } else {
    console.error('No favicon link found');
  }
};

// Export for use in console
declare global {
  interface Window {
    testFaviconChanges: () => void;
  }
}

if (typeof window !== 'undefined') {
  window.testFaviconChanges = testFaviconChanges;
  console.log('Run testFaviconChanges() in the console to test favicon changes');
}
