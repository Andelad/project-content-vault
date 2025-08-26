import React from 'react';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

export function ViewErrorFallback({ error, resetError }: ErrorFallbackProps) {
  React.useEffect(() => {
    if (error) {
      console.error('View component error:', error);
      console.error('Stack trace:', error.stack);
    }
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center bg-background h-full">
      <div className="text-center max-w-md p-6">
        <h2 className="text-lg font-semibold mb-2">Unable to load this view</h2>
        <p className="text-muted-foreground mb-4">Please try refreshing the page.</p>
        
        {error && (
          <details className="text-left text-sm">
            <summary className="cursor-pointer mb-2">Error Details</summary>
            <div className="bg-muted p-3 rounded text-xs">
              <div><strong>Error:</strong> {error.message}</div>
              {error.stack && (
                <div className="mt-2">
                  <strong>Stack:</strong>
                  <pre className="text-xs overflow-auto max-h-32 mt-1">{error.stack}</pre>
                </div>
              )}
            </div>
          </details>
        )}
        
        {resetError && (
          <button 
            onClick={resetError}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
