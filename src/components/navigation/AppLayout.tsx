import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useIsMobile } from '@/hooks/use-mobile';
import TopNavBar from './TopNavBar';
import SideNavBar from './SideNavBar';
import BottomNavBar from './BottomNavBar';
import Breadcrumbs from './Breadcrumbs';

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

  if (!profile) {
    return <div>{children}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <TopNavBar />
      
      <div className="flex">
        {/* Desktop Side Navigation */}
        {!isMobile && (
          <SideNavBar />
        )}
        
        {/* Main Content Area */}
        <main className={`flex-1 transition-all duration-300 ${
          !isMobile && !sidebarCollapsed ? 'ml-64' : ''
        } ${
          !isMobile && sidebarCollapsed ? 'ml-20' : ''
        }`}>
          {/* Breadcrumbs */}
          {showBreadcrumbs && !isMobile && (
            <div className="bg-white border-b border-gray-200">
              <div className="px-4 sm:px-6 lg:px-8">
                <Breadcrumbs />
              </div>
            </div>
          )}
          
          {/* Page Content */}
          <div className={`${isMobile ? 'pb-20' : ''} min-h-[calc(100vh-64px)]`}>
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