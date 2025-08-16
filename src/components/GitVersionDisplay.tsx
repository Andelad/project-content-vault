import React from 'react';

export function GitVersionDisplay() {
  const commitHash = import.meta.env.VITE_GIT_COMMIT_HASH;
  const commitCount = import.meta.env.VITE_GIT_COMMIT_COUNT;
  const branchName = import.meta.env.VITE_GIT_BRANCH;

  // Debug: Always show for now
  console.log('Git info:', { commitHash, commitCount, branchName });

  return (
    <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
      <div>Branch: {branchName || 'unknown'}</div>
      <div>Commit: #{commitCount || '0'} ({commitHash || 'unknown'})</div>
    </div>
  );
}