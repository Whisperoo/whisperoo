import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export interface NavigationItem {
  id: string;
  title: string;
  path: string;
  icon: string;
  badge?: string | number;
  visible?: boolean;
}

interface NavigationHistory {
  path: string;
  title: string;
  timestamp: number;
}

interface NavigationContextType {
  // Sidebar state
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Navigation items
  primaryNavItems: NavigationItem[];
  accountNavItems: NavigationItem[];
  expertNavItems: NavigationItem[];
  secondaryNavItems: NavigationItem[];
  
  // Navigation history
  navigationHistory: NavigationHistory[];
  addToHistory: (path: string, title: string) => void;
  
  // Current route info
  currentRoute: {
    path: string;
    title: string;
    breadcrumbs: Array<{ title: string; path?: string }>;
  };
  
  // Quick actions
  isQuickActionsOpen: boolean;
  setQuickActionsOpen: (open: boolean) => void;
  
  // Mobile navigation
  isMobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  
  // Logout functionality
  handleLogout: () => Promise<void>;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

interface NavigationProviderProps {
  children: ReactNode;
}

// Route configuration with titles and breadcrumbs
const routeConfig: Record<string, { title: string; breadcrumbs: Array<{ title: string; path?: string }> }> = {
  '/dashboard': {
    title: 'Dashboard',
    breadcrumbs: [{ title: 'Dashboard' }]
  },
  '/chat': {
    title: 'Chat Genie',
    breadcrumbs: [
      { title: 'Dashboard', path: '/dashboard' },
      { title: 'Chat Genie' }
    ]
  },
  '/experts': {
    title: 'Expert Profiles',
    breadcrumbs: [
      { title: 'Dashboard', path: '/dashboard' },
      { title: 'Expert Profiles' }
    ]
  },
  '/products': {
    title: 'Resources',
    breadcrumbs: [
      { title: 'Dashboard', path: '/dashboard' },
      { title: 'Resources' }
    ]
  },
  '/my-purchases': {
    title: 'My Content',
    breadcrumbs: [
      { title: 'Dashboard', path: '/dashboard' },
      { title: 'Resources', path: '/products' },
      { title: 'My Content' }
    ]
  },
  '/expert-dashboard': {
    title: 'Expert Dashboard',
    breadcrumbs: [{ title: 'Expert Dashboard' }]
  },
  '/expert-settings': {
    title: 'Expert Settings',
    breadcrumbs: [
      { title: 'Expert Dashboard', path: '/expert-dashboard' },
      { title: 'Settings' }
    ]
  },
  '/profile': {
    title: 'Profile',
    breadcrumbs: [
      { title: 'Dashboard', path: '/dashboard' },
      { title: 'Profile' }
    ]
  },
  '/settings': {
    title: 'Settings',
    breadcrumbs: [
      { title: 'Dashboard', path: '/dashboard' },
      { title: 'Settings' }
    ]
  },
  '/help': {
    title: 'Help & Support',
    breadcrumbs: [
      { title: 'Help & Support' }
    ]
  }
};

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  
  // Sidebar state - get from localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('whisperoo-sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  
  // Quick actions state
  const [isQuickActionsOpen, setQuickActionsOpen] = useState(false);
  
  // Mobile navigation state
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  
  // Navigation history
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistory[]>(() => {
    const saved = localStorage.getItem('whisperoo-nav-history');
    return saved ? JSON.parse(saved) : [];
  });

  // Primary navigation items
  const primaryNavItems: NavigationItem[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      path: '/dashboard',
      icon: 'Home',
      visible: true
    },
    {
      id: 'chat',
      title: 'Chat Genie',
      path: '/chat',
      icon: 'MessageCircle',
      visible: true
    },
    {
      id: 'experts',
      title: 'Find Experts',
      path: '/experts',
      icon: 'Users',
      visible: true
    },
    {
      id: 'resources',
      title: 'Resources',
      path: '/products',
      icon: 'Package',
      visible: true
    },
    {
      id: 'purchases',
      title: 'My Content',
      path: '/my-purchases',
      icon: 'ShoppingBag',
      visible: true
    }
  ];

  // Account navigation items (Profile only for non-experts)
  const accountNavItems: NavigationItem[] = [
    // Only show Profile for non-expert users
    ...(profile?.account_type !== 'expert' ? [{
      id: 'profile',
      title: 'Profile',
      path: '/profile',
      icon: 'User',
      visible: true
    }] : [])
  ];

  // Expert navigation items (only visible for experts)
  const expertNavItems: NavigationItem[] = profile?.account_type === 'expert' ? [
    {
      id: 'expert-dashboard',
      title: 'Expert Dashboard',
      path: '/expert-dashboard',
      icon: 'BarChart3',
      visible: true
    },
    {
      id: 'expert-settings',
      title: 'Expert Settings',
      path: '/expert-settings',
      icon: 'Settings',
      visible: true
    }
  ] : [];

  // Secondary navigation items (support)
  const secondaryNavItems: NavigationItem[] = [
    {
      id: 'help',
      title: 'Help & Support',
      path: '/help',
      icon: 'HelpCircle',
      visible: true
    }
  ];

  // Get current route info
  const getCurrentRoute = () => {
    const currentPath = location.pathname;
    const config = routeConfig[currentPath] || {
      title: 'Whisperoo',
      breadcrumbs: [{ title: 'Whisperoo' }]
    };
    
    return {
      path: currentPath,
      title: config.title,
      breadcrumbs: config.breadcrumbs
    };
  };

  const currentRoute = getCurrentRoute();

  // Add to navigation history
  const addToHistory = (path: string, title: string) => {
    const newHistoryItem: NavigationHistory = {
      path,
      title,
      timestamp: Date.now()
    };
    
    setNavigationHistory(prev => {
      // Remove existing entry for this path
      const filtered = prev.filter(item => item.path !== path);
      // Add new entry at the beginning
      const newHistory = [newHistoryItem, ...filtered].slice(0, 10); // Keep only last 10
      
      // Save to localStorage
      localStorage.setItem('whisperoo-nav-history', JSON.stringify(newHistory));
      
      return newHistory;
    });
  };

  // Update sidebar state in localStorage
  useEffect(() => {
    localStorage.setItem('whisperoo-sidebar-collapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Add current route to history when location changes
  useEffect(() => {
    const routeConfig = getCurrentRoute();
    addToHistory(location.pathname, routeConfig.title);
  }, [location.pathname]);

  // Logout handler
  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
  };

  // Close mobile nav when route changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const contextValue: NavigationContextType = {
    sidebarCollapsed,
    setSidebarCollapsed,
    primaryNavItems,
    accountNavItems,
    expertNavItems,
    secondaryNavItems,
    navigationHistory,
    addToHistory,
    currentRoute,
    isQuickActionsOpen,
    setQuickActionsOpen,
    isMobileNavOpen,
    setMobileNavOpen,
    handleLogout
  };

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  );
};