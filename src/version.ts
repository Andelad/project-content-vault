// This file provides fallback version information for deployed builds
// Update this manually when making significant changes that need tracking

export const VERSION_INFO = {
  version: '1.0.0',
  codename: 'TimelineView Enhancement',
  releaseDate: '2025-08-16',
  features: [
    'Enhanced timeline positioning',
    'Improved work hour management',
    'Performance optimizations',
    'Better version tracking'
  ]
};

export const getVersionString = () => {
  return `v${VERSION_INFO.version} (${VERSION_INFO.codename})`;
};
