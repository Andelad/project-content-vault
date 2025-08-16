import React from 'react';

export function GitVersionDisplay() {
  // Show in both development and production for now (you can change this later)
  // if (!import.meta.env.PROD) {
  //   return null;
  // }

  const commitHash = import.meta.env.VITE_GIT_COMMIT_HASH;
  const commitCount = import.meta.env.VITE_GIT_COMMIT_COUNT;
  const branchName = import.meta.env.VITE_GIT_BRANCH;

  // Don't render if no git info available
  if (!commitHash || commitHash === 'unknown') {
    return null;
  }

  return (
    <div className="px-4 py-2 text-xs text-muted-foreground">
      {branchName} #{commitCount} ({commitHash})
    </div>
  );
}