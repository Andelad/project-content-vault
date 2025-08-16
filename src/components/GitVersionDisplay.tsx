import React from 'react';
import { VERSION_INFO, getVersionString } from '../version';

export function GitVersionDisplay() {
  const buildDate = import.meta.env.VITE_BUILD_DATE;

  return (
    <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
      {/* Show app version */}
      <div className="font-medium">{getVersionString()}</div>
      
      {/* Show build date */}
      {buildDate && (
        <div className="mt-1 text-xs opacity-75">
          Built: {buildDate}
        </div>
      )}
    </div>
  );
}