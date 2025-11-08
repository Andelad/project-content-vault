import React from 'react';

interface SupabaseConfigErrorProps {
  errorMessage: string;
}

/**
 * Error screen displayed when Supabase is not properly configured.
 * Shows instructions for setting up environment variables.
 */
export function SupabaseConfigError({ errorMessage }: SupabaseConfigErrorProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-muted/20 px-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Supabase configuration required</h1>
      <p className="text-muted-foreground max-w-md">
        {errorMessage} You can set these values in a local <code>.env</code> file at the project root or export them in your shell before running <code>npm run dev</code>.
      </p>
      <div className="rounded-md bg-background border px-4 py-3 text-sm font-mono text-left shadow-sm">
{`VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key`}
      </div>
      <p className="text-sm text-muted-foreground max-w-md">
        After updating your environment variables, restart the development server.
      </p>
    </div>
  );
}
