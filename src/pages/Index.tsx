
import React from 'react';
import { Navigate } from 'react-router-dom';

const Index: React.FC = () => {
  // Redirect to splash screen
  return <Navigate to="/" replace />;
};

export default Index;
