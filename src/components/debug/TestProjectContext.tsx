import React from 'react';
import { ProjectProvider } from '../../contexts/ProjectContext';

function TestProjectContext() {
  return (
    <ProjectProvider>
      <div>ProjectContext loaded successfully!</div>
    </ProjectProvider>
  );
}

export default TestProjectContext;
