import React from 'react';
import { ContextProviders } from '../../contexts/ContextProviders';
import { useProjectContext } from '../../contexts/ProjectContext';

function TestComponent() {
  const { projects } = useProjectContext();
  
  return <div>Projects loaded: {projects?.length || 0}</div>;
}

function DebugView() {
  return (
    <ContextProviders>
      <div style={{ padding: '20px' }}>
        <h1>Debug Context Loading</h1>
        <TestComponent />
      </div>
    </ContextProviders>
  );
}

export default DebugView;
