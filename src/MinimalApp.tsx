import React from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

// Step 3: Test with Router and Tooltip Provider
const MinimalApp = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="*" element={
              <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
                <h1 style={{ color: 'orange' }}>🔍 Testing Full Provider Stack</h1>
                <p>If you can see this, QueryClient + AuthProvider + TooltipProvider + BrowserRouter are working.</p>
              </div>
            } />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default MinimalApp;