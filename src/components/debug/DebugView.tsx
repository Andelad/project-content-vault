import React from 'react';
import { AppProviders } from '../../contexts/AppProviders';
import { useProjectContext } from '../../contexts/ProjectContext';

function TestComponent() {
  try {
    const { projects } = useProjectContext();
    return <div>Projects loaded: {projects?.length || 0}</div>;
  } catch (error) {
    return <div>Error: {error.message}</div>;
  }
}

function DebugView() {
  return (
    <AppProviders>
      <div style={{ padding: '20px' }}>
        <h1>Debug Context Loading</h1>
        <TestComponent />
      </div>
    </AppProviders>
  );
}

export default DebugView;
