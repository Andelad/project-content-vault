import React from 'react';
import { AppProviders } from '../../contexts/AppProviders';

function TestContexts() {
  try {
    return (
      <AppProviders>
        <div>Contexts loaded successfully!</div>
      </AppProviders>
    );
  } catch (error) {
    return <div>Error loading contexts: {error.message}</div>;
  }
}

export default TestContexts;
