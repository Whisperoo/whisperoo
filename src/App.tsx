import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NavigationProvider } from "@/contexts/NavigationContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/navigation/AppLayout";
import Splash from "./pages/Splash";
import CreateAccount from "./pages/auth/CreateAccount";
import CreateAccountSimple from "./pages/auth/CreateAccountSimple";
import VerifyOTP from "./pages/auth/VerifyOTP";
import Login from "./pages/auth/Login";
import OnboardingKids from "./pages/onboarding/OnboardingKids";
import OnboardingRole from "./pages/onboarding/OnboardingRole";
import OnboardingKidsCount from "./pages/onboarding/OnboardingKidsCount";
import OnboardingKidsAges from "./pages/onboarding/OnboardingKidsAges";
import OnboardingParentingStyles from "./pages/onboarding/OnboardingParentingStyles";
import OnboardingTopics from "./pages/onboarding/OnboardingTopics";
import OnboardingComplete from "./pages/onboarding/OnboardingComplete";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import ExpertProfiles from "./pages/ExpertProfiles";
import ExpertDetails from "./pages/ExpertDetails";
import { ProductsPage } from "./pages/ProductsPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { MyPurchasesPage } from "./pages/MyPurchasesPage";
import { PurchaseSuccessPage } from "./pages/PurchaseSuccessPage";
import { AdminProductsPage } from "./pages/AdminProductsPage";
import { ExpertDashboard } from "./components/expert/ExpertDashboard";
import ExpertProfileSettings from "./pages/ExpertProfileSettings";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import { HelpSupportPage } from "./pages/HelpSupportPage";
import DebugAuth from "./pages/DebugAuth";
import TestForm from "./pages/TestForm";
import TestSupabase from "./pages/TestSupabase";
import DebugSignup from "./pages/DebugSignup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

console.log('App component loading...');

const App = () => {
  console.log('App component rendering...');
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <NavigationProvider>
            <Routes>
              <Route path="/" element={<Splash />} />
              <Route path="/auth/create" element={<CreateAccount />} />
              <Route path="/auth/create-simple" element={<CreateAccountSimple />} />
              <Route path="/auth/verify" element={<VerifyOTP />} />
              <Route path="/auth/login" element={<Login />} />
              <Route path="/onboarding/kids" element={
                <ProtectedRoute requireAuth={true}>
                  <OnboardingKids />
                </ProtectedRoute>
              } />
              <Route path="/onboarding/role" element={
                <ProtectedRoute requireAuth={true}>
                  <OnboardingRole />
                </ProtectedRoute>
              } />
              <Route path="/onboarding/kids-count" element={
                <ProtectedRoute requireAuth={true}>
                  <OnboardingKidsCount />
                </ProtectedRoute>
              } />
              <Route path="/onboarding/kids-ages" element={
                <ProtectedRoute requireAuth={true}>
                  <OnboardingKidsAges />
                </ProtectedRoute>
              } />
              <Route path="/onboarding/parenting-styles" element={
                <ProtectedRoute requireAuth={true}>
                  <OnboardingParentingStyles />
                </ProtectedRoute>
              } />
              <Route path="/onboarding/topics" element={
                <ProtectedRoute requireAuth={true}>
                  <OnboardingTopics />
                </ProtectedRoute>
              } />
              <Route path="/onboarding/complete" element={
                <ProtectedRoute requireAuth={true}>
                  <OnboardingComplete />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute requireAuth={true} requireOnboarding={true}>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/chat" element={
                <ProtectedRoute requireAuth={true} requireOnboarding={true}>
                  <AppLayout>
                    <Chat />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/experts" element={
                <ProtectedRoute requireAuth={true} requireOnboarding={true}>
                  <AppLayout>
                    <ExpertProfiles />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/experts/:id" element={
                <ProtectedRoute requireAuth={true} requireOnboarding={true}>
                  <AppLayout>
                    <ExpertDetails />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/products" element={
                <ProtectedRoute requireAuth={true} requireOnboarding={true}>
                  <AppLayout>
                    <ProductsPage />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/products/:productId" element={
                <ProtectedRoute requireAuth={true} requireOnboarding={true}>
                  <AppLayout>
                    <ProductDetailPage />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/my-purchases" element={
                <ProtectedRoute requireAuth={true} requireOnboarding={true}>
                  <AppLayout>
                    <MyPurchasesPage />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute requireAuth={true} requireOnboarding={true}>
                  <AppLayout>
                    <ProfilePage />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute requireAuth={true} requireOnboarding={true}>
                  <AppLayout>
                    <SettingsPage />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/purchase-success/:productId" element={
                <ProtectedRoute requireAuth={true} requireOnboarding={true}>
                  <AppLayout>
                    <PurchaseSuccessPage />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/expert-dashboard" element={
                <ProtectedRoute requireAuth={true} requireOnboarding={true}>
                  <AppLayout>
                    <ExpertDashboard />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/expert-settings" element={
                <ProtectedRoute requireAuth={true} requireOnboarding={true}>
                  <AppLayout>
                    <ExpertProfileSettings />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/products" element={
                <ProtectedRoute requireAuth={true}>
                  <AdminProductsPage />
                </ProtectedRoute>
              } />
              <Route path="/help" element={
                <ProtectedRoute requireAuth={true} requireOnboarding={true}>
                  <AppLayout>
                    <HelpSupportPage />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/debug" element={<DebugAuth />} />
              <Route path="/test" element={<TestForm />} />
              <Route path="/test-supabase" element={<TestSupabase />} />
              <Route path="/debug-signup" element={<DebugSignup />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </NavigationProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;