import React from 'react';
import { Navigate } from 'react-router-dom';

const Index = () => {
  // Redirect to /app for authenticated users or landing page
  return <Navigate to="/app" replace />;
};

export default Index;
