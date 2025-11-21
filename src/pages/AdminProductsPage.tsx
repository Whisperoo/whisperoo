import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProductFileUploader } from '@/components/admin/ProductFileUploader';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const AdminProductsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Simple admin check - you might want to make this more robust
  const isAdmin = user?.email === 'admin@whisperoo.com' || 
                  user?.email === 'test@example.com' ||
                  user?.email?.includes('admin');

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You don't have permission to access this page.
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F2EBE5' }}>
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Admin: Product File Management</h1>
          <p className="text-muted-foreground mt-2">
            Upload and manage product files for all products in the system.
          </p>
        </div>
        
        <ProductFileUploader />
      </div>
    </div>
  );
};