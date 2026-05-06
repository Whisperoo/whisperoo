import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import TopNavBar from './TopNavBar';
import SideNavBar from './SideNavBar';
import BottomNavBar from './BottomNavBar';
import Breadcrumbs from './Breadcrumbs';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  showBreadcrumbs?: boolean;
}

const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  showBreadcrumbs = true 
}) => {
  const { profile } = useAuth();
  const { sidebarCollapsed, isMobileNavOpen } = useNavigation();
  const isMobile = useIsMobile();
  
  // Initialize HIPAA inactivity timeout for authenticated routes
  useInactivityTimeout();

  if (!profile) {
    return <div>{children}</div>;
  }

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Top Navigation Bar */}
      <TopNavBar />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Side Navigation Wrapper */}
        {!isMobile && (
          <aside className={cn(
            "flex-shrink-0 border-r border-gray-200 bg-white transition-all duration-300",
            sidebarCollapsed ? "w-20" : "w-64"
          )}>
            <SideNavBar />
          </aside>
        )}
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto min-w-0 bg-gray-50 flex flex-col">
          {/* Breadcrumbs */}
          {showBreadcrumbs && !isMobile && (
            <div className="bg-white border-b border-gray-200 w-full flex-shrink-0">
              <div className="px-4 sm:px-6 lg:px-8">
                <Breadcrumbs />
              </div>
            </div>
          )}
          
          {/* Page Content */}
          <div className={cn(
            "flex-1 w-full",
            isMobile ? "pb-24" : "pb-8"
          )}>
            {children}
          </div>
        </main>
      </div>
      
      {/* Mobile Bottom Navigation */}
      {isMobile && <BottomNavBar />}
      
      {/* Mobile Navigation Overlay */}
      {isMobile && isMobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" />
          <div className="fixed top-0 left-0 w-64 h-full bg-white shadow-xl">
            <SideNavBar isMobileOverlay />
          </div>
        </div>
      )}
    </div>
  );
};

export default AppLayout;