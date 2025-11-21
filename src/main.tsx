import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'
import './index.css'

const root = document.getElementById("root");

if (!root) {
  console.error("Root element not found!");
  document.body.innerHTML = '<h1 style="color: red;">Root element not found!</h1>';
  throw new Error("Root element not found");
}

console.log('Starting app render...', root);

createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
