import React, { useState } from 'react';
import { Phone, Copy } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const AIMomCallModule: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const phoneNumber = '(380) 212-1433';

  const handleClick = () => {
    if (isMobile) {
      // Mobile: initiate phone call
      window.location.href = `tel:${phoneNumber}`;
    } else {
      // Desktop: show popup
      setIsDialogOpen(true);
    }
  };

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(phoneNumber).then(() => {
      toast.success('Phone number copied to clipboard!');
      setIsDialogOpen(false);
    });
  };

  return (
    <>
      <div 
        onClick={handleClick}
        className="bg-white rounded-xl shadow-card p-6 mb-6 border border-gray-200 cursor-pointer hover:shadow-elevated transition-all duration-200 hover:border-brand-primary"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Phone className="w-5 h-5 text-brand-primary" />
            <h2 className="text-lg font-semibold text-brand-primary">
              Call Your AI Mom BFF, Kate
            </h2>
          </div>
        </div>
        <p className="text-gray-600 leading-relaxed">
          Real-time support and mom wisdom, always just a phone call away.
        </p>
      </div>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <Phone className="w-5 h-5 text-brand-primary" />
              <span>Call Kate</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center py-4">
              <div className="text-2xl font-bold text-brand-primary mb-2">
                {phoneNumber}
              </div>
              <p>Use your phone to call this number for real-time support and mom wisdom.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0">
            <Button 
              onClick={handleCopyNumber}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Copy className="w-4 h-4" />
              <span>Copy Number</span>
            </Button>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AIMomCallModule;