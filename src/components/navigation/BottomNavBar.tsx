import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, MessageCircle, Users, Package, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const BottomNavBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Home',
      path: '/dashboard',
      icon: Home,
    },
    {
      id: 'chat',
      label: 'Chat Genie',
      path: '/chat',
      icon: MessageCircle,
      badge: null
    },
    {
      id: 'experts',
      label: 'Experts',
      path: '/experts',
      icon: Users,
    },
    {
      id: 'resources',
      label: 'Resources',
      path: '/products',
      icon: Package,
    },
    {
      id: 'purchases',
      label: 'My Content',
      path: '/my-purchases',
      icon: ShoppingBag,
    }
  ];

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleNavigation = (item: typeof navItems[0]) => {
    navigate(item.path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-30">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const active = isActive(item.path);
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              className={cn(
                "flex flex-col items-center justify-center space-y-1 p-2 h-auto min-w-[60px] relative",
                active ? "text-brand-primary" : "text-gray-500"
              )}
              onClick={() => handleNavigation(item)}
            >
              <div className="relative">
                <IconComponent className={cn(
                  "h-5 w-5",
                  active ? "text-brand-primary" : "text-gray-500"
                )} />
                {item.badge && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-xs"
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-xs font-medium",
                active ? "text-brand-primary" : "text-gray-500"
              )}>
                {item.label}
              </span>
              
              {/* Active indicator */}
              {active && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-brand-primary rounded-full" />
              )}
            </Button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavBar;