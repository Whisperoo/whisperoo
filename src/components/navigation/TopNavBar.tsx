import React from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/contexts/NavigationContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

const TopNavBar: React.FC = () => {
  const { 
    setMobileNavOpen, 
    isMobileNavOpen 
  } = useNavigation();
  const { profile } = useAuth();
  const { isHospitalUser, config } = useTenant();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - Logo and Mobile Menu */}
          <div className="flex items-center space-x-4">
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileNavOpen(!isMobileNavOpen)}
                className="p-2"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            
            <div className="flex items-center min-w-0 flex-1">
              <div 
                className="flex items-center space-x-1.5 sm:space-x-2 cursor-pointer flex-shrink-0" 
                onClick={() => navigate('/dashboard')}
              >
                <img 
                  src="/stork-avatar.png" 
                  alt="Whisperoo" 
                  className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
                />
                <span className="text-base sm:text-xl font-bold text-brand-primary font-['Plus_Jakarta_Sans'] truncate max-w-[100px] xs:max-w-none">
                  Whisperoo
                </span>
              </div>

              {isHospitalUser && config?.branding?.logo_url && (
                <div className="flex items-center min-w-0 flex-shrink ml-2 sm:ml-0">
                  <div className="h-6 w-px bg-gray-200 mx-2 sm:mx-4 flex-shrink-0" />
                  <img 
                    src={config.branding.logo_url} 
                    alt="Hospital Logo" 
                    className="h-7 sm:h-10 object-contain min-w-0 max-w-[80px] sm:max-w-none" 
                  />
                </div>
              )}
            </div>
          </div>


          {/* Right side - Actions and Profile */}
          <div className="flex items-center space-x-2">


            {/* User Avatar Display */}
            {profile && (
              <div className="flex items-center space-x-2">
                <Avatar 
                  className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all" 
                  onClick={() => navigate('/profile')}
                >
                  <AvatarImage 
                    src={profile.profile_image_url || undefined} 
                    alt={profile.first_name}
                  />
                  <AvatarFallback className="bg-brand-primary text-white text-sm font-semibold">
                    {profile.first_name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {!isMobile && (
                  <span className="text-sm font-medium text-gray-700 hidden md:block">
                    {profile.first_name}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default TopNavBar;