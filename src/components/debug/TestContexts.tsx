import React from 'react';
import { ContextProviders } from '../../contexts/ContextProviders';

function TestContexts() {
  try {
    return (
      <ContextProviders>
        <div>Contexts loaded successfully!</div>
      </ContextProviders>
    );
  } catch (error) {
    return <div>Error loading contexts: {error.message}</div>;
  }
}

export default TestContexts;
