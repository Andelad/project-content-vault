import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 ErrorBoundary caught an error:', error);
    console.error('🚨 Error Info:', errorInfo);
    console.error('🚨 Error message:', error.message);
    console.error('🚨 Error stack:', error.stack);
    this.setState({
      error,
      errorInfo,
    });

    // Log to external error reporting service if available
    // logErrorToService(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-background p-6">
          <div className="max-w-md w-full">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription className="mt-2">
                An unexpected error occurred. You can try refreshing the page or contact support if the problem persists.
              </AlertDescription>
            </Alert>

            <div className="mt-4 flex gap-2">
              <Button onClick={this.handleRetry} variant="outline" className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={this.handleReload} className="flex-1">
                Reload Page
              </Button>
            </div>

            {this.props.showDetails && this.state.error && (
              <details className="mt-4 p-4 bg-muted rounded-lg text-sm">
                <summary className="cursor-pointer font-medium mb-2">
                  Technical Details
                </summary>
                <div className="space-y-2 text-muted-foreground">
                  <div>
                    <strong>Error:</strong> {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong>Stack trace:</strong>
                      <pre className="mt-1 text-xs overflow-auto max-h-32 bg-background p-2 rounded border">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Convenience wrapper for lazy-loaded components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}