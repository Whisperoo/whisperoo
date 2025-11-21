import React from 'react';
import { Button } from '@/components/ui/button';
import { Baby, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { calculateAge } from '@/utils/age';

interface Child {
  id: string;
  first_name: string;
  birth_date: string | null;
  age: string | null;
  is_expecting: boolean;
  expected_name?: string;
}

interface ChildSwitcherProps {
  children: Child[];
  selectedChild: Child | null;
  onChildSelect: (child: Child | null) => void;
}

const ChildSwitcher: React.FC<ChildSwitcherProps> = ({
  children,
  selectedChild,
  onChildSelect,
}) => {
  if (children.length === 0) {
    return null;
  }

  const getChildDisplayName = (child: Child) => {
    if (child.is_expecting) {
      return child.expected_name || 'Expected Baby';
    }
    return child.first_name || 'Child';
  };

  const getChildAge = (child: Child) => {
    if (child.is_expecting) {
      return 'Expecting';
    }
    if (child.birth_date) {
      return calculateAge(child.birth_date);
    }
    // Fallback to stored age for backward compatibility
    return child.age || '';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center space-x-2 hover:bg-blue-50 rounded-2xl"
          style={{ color: '#2E54A5', borderColor: '#2E54A5' }}
        >
          {selectedChild ? (
            <>
              <Baby className="w-4 h-4" />
              <span>{getChildDisplayName(selectedChild)}</span>
              {getChildAge(selectedChild) && (
                <span className="text-xs" style={{ color: '#2E54A5' }}>
                  ({getChildAge(selectedChild)})
                </span>
              )}
            </>
          ) : (
            <>
              <Users className="w-4 h-4" />
              <span>General</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 border-gray-200 shadow-lg rounded-2xl">
        <DropdownMenuItem
          onClick={() => onChildSelect(null)}
          className={`flex items-center space-x-2 rounded-xl m-1 ${
            !selectedChild ? 'bg-blue-50' : 'hover:bg-gray-50'
          }`}
          style={!selectedChild ? { color: '#2E54A5' } : {}}
        >
          <Users className="w-4 h-4" />
          <div>
            <div className="font-medium">General Questions</div>
            <div className="text-xs text-gray-500">About parenting in general</div>
          </div>
        </DropdownMenuItem>
        
        {children.map((child) => (
          <DropdownMenuItem
            key={child.id}
            onClick={() => onChildSelect(child)}
            className={`flex items-center space-x-2 rounded-xl m-1 ${
              selectedChild?.id === child.id ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
            style={selectedChild?.id === child.id ? { color: '#2E54A5' } : {}}
          >
            <Baby className="w-4 h-4" />
            <div>
              <div className="font-medium">{getChildDisplayName(child)}</div>
              {getChildAge(child) && (
                <div className="text-xs text-gray-500">{getChildAge(child)}</div>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ChildSwitcher;