import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  MessageCircle, 
  Users, 
  Package, 
  ShoppingBag, 
  Settings, 
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  BarChart3,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/contexts/NavigationContext';
import type { NavigationItem } from '@/contexts/NavigationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SideNavBarProps {
  isMobileOverlay?: boolean;
}

const iconMap = {
  Home,
  MessageCircle,
  Users,
  Package,
  ShoppingBag,
  Settings,
  HelpCircle,
  User,
  BarChart3,
  LogOut
};

const SideNavBar: React.FC<SideNavBarProps> = ({ isMobileOverlay = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { 
    sidebarCollapsed, 
    setSidebarCollapsed,
    primaryNavItems,
    accountNavItems,
    expertNavItems,
    secondaryNavItems,
    setMobileNavOpen,
    handleLogout
  } = useNavigation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobileOverlay) {
      setMobileNavOpen(false);
    }
  };

  const NavItem = ({ item, isSecondary = false }: { item: NavigationItem; isSecondary?: boolean }) => {
    const IconComponent = iconMap[item.icon as keyof typeof iconMap];
    const active = isActive(item.path);
    
    return (
      <Button
        variant={active ? "default" : "ghost"}
        className={cn(
          "w-full justify-start text-left font-normal",
          sidebarCollapsed && !isMobileOverlay ? "px-3" : "px-4",
          active ? "bg-brand-primary text-white hover:bg-brand-dark" : "hover:bg-gray-100",
          isSecondary && "text-gray-600"
        )}
        onClick={() => handleNavigation(item.path)}
      >
        <IconComponent className={cn(
          "h-5 w-5",
          sidebarCollapsed && !isMobileOverlay ? "" : "mr-3"
        )} />
        {(!sidebarCollapsed || isMobileOverlay) && (
          <>
            <span className="flex-1">{item.title}</span>
            {item.badge && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </Button>
    );
  };

  return (
    <div className={cn(
      "bg-white flex flex-col h-full transition-all duration-300",
      isMobileOverlay && "fixed top-0 left-0 w-64 z-50 shadow-xl",
      sidebarCollapsed && !isMobileOverlay ? "w-20" : "w-64"
    )}>
      {/* Mobile Header */}
      {isMobileOverlay && (
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src="/stork-avatar.png" 
              alt="Whisperoo" 
              className="w-8 h-8 object-contain"
            />
            <span className="text-xl font-semibold text-brand-primary">
              Whisperoo
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileNavOpen(false)}
            className="p-2"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Desktop Collapse Toggle */}
        {!isMobileOverlay && (
          <div className="p-4 border-b border-gray-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={cn(
                "w-full justify-center rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300",
                sidebarCollapsed ? "h-9" : "h-10"
              )}
            >
              {sidebarCollapsed ? 
                <ChevronRight className="h-4 w-4" /> : 
                <ChevronLeft className="h-4 w-4" />
              }
            </Button>
          </div>
        )}

        {/* Primary Navigation */}
        <div className="p-4 space-y-2">
          {(!sidebarCollapsed || isMobileOverlay) && (
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Navigation
            </h3>
          )}
          {primaryNavItems.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-gray-200" />

        {/* Account Section */}
        <div className="p-4 space-y-2">
          {(!sidebarCollapsed || isMobileOverlay) && (
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Account
            </h3>
          )}
          {accountNavItems.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </div>

        {/* Expert Section - Only show if user is expert */}
        {expertNavItems.length > 0 && (
          <>
            <div className="mx-4 border-t border-gray-200" />
            <div className="p-4 space-y-2">
              {(!sidebarCollapsed || isMobileOverlay) && (
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Expert Tools
                </h3>
              )}
              {expertNavItems.map((item) => (
                <NavItem key={item.id} item={item} />
              ))}
            </div>
          </>
        )}

        {/* Divider */}
        <div className="mx-4 border-t border-gray-200" />

        {/* Secondary Navigation */}
        <div className="p-4 space-y-2">
          {(!sidebarCollapsed || isMobileOverlay) && (
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Support
            </h3>
          )}
          {secondaryNavItems.map((item) => (
            <NavItem key={item.id} item={item} isSecondary />
          ))}
        </div>

      </div>

      {/* Bottom Section - User Profile and Logout */}
      {profile && (
        <div className="p-4 border-t border-gray-200 space-y-3">
          {/* User Profile Display */}
          {(!sidebarCollapsed || isMobileOverlay) && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {profile.first_name?.[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {profile.first_name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          )}
          
          {/* Logout Button */}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-left font-normal text-red-600 hover:text-red-700 hover:bg-red-50",
              sidebarCollapsed && !isMobileOverlay ? "px-3" : "px-4"
            )}
            onClick={handleLogout}
          >
            <LogOut className={cn(
              "h-5 w-5",
              sidebarCollapsed && !isMobileOverlay ? "" : "mr-3"
            )} />
            {(!sidebarCollapsed || isMobileOverlay) && (
              <span className="flex-1">Log out</span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default SideNavBar;