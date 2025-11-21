import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/contexts/NavigationContext';
import { cn } from '@/lib/utils';

const Breadcrumbs: React.FC = () => {
  const navigate = useNavigate();
  const { currentRoute } = useNavigation();

  if (!currentRoute.breadcrumbs || currentRoute.breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex py-3" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-1">
        {currentRoute.breadcrumbs.map((crumb, index) => {
          const isLast = index === currentRoute.breadcrumbs.length - 1;
          const isFirst = index === 0;
          
          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 text-gray-400 mr-1" />
              )}
              
              {crumb.path ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(crumb.path!)}
                  className={cn(
                    "text-sm font-medium px-2 py-1 h-auto",
                    isFirst ? "text-gray-500 hover:text-gray-700" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {isFirst && <Home className="h-4 w-4 mr-1" />}
                  {crumb.title}
                </Button>
              ) : (
                <span className={cn(
                  "text-sm font-medium px-2 py-1",
                  isLast ? "text-gray-900" : "text-gray-500"
                )}>
                  {isFirst && <Home className="h-4 w-4 mr-1 inline" />}
                  {crumb.title}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;