import React from 'react';
import { ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  backTo?: string;
  onSettingsClick?: () => void;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({
  title = "Whisperoo",
  showBackButton = false,
  backTo = "/dashboard",
  onSettingsClick,
  className = ""
}) => {
  const navigate = useNavigate();

  return (
    <header className={`bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10 ${className}`}>
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side */}
          <div className="flex items-center space-x-3">
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(backTo)}
                className="flex items-center space-x-2 hover:bg-brand-light text-brand-primary"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            )}
            <div className="flex items-center space-x-3">
              <img 
                src="/stork-avatar.png" 
                alt="Whisperoo" 
                className="w-7 h-7 object-contain"
              />
              <h1 className="text-lg sm:text-xl font-semibold text-brand-primary">{title}</h1>
            </div>
          </div>

          {/* Right side - empty for now */}
          <div></div>
        </div>
      </div>
    </header>
  );
};

export default Header;