import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Star, Award, GraduationCap, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { ExpertProductsSection } from '@/components/expert/ExpertProductsSection';
import { PurchaseModal } from '@/components/products/PurchaseModal';
import { ProductWithDetails } from '@/services/products';
import { useAuth } from '@/contexts/AuthContext';

interface ExpertProfile {
  id: string;
  first_name: string;
  expert_bio: string;
  expert_specialties: string[];
  expert_experience_years: number;
  expert_credentials: string[];
  profile_image_url: string;
  expert_consultation_rate: number;
  expert_rating: number;
  expert_total_reviews: number;
  expert_availability_status: string;
  expert_verified: boolean;
}

const ExpertDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expert, setExpert] = useState<ExpertProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [consultationProduct, setConsultationProduct] = useState<ProductWithDetails | null>(null);

  useEffect(() => {
    if (id) {
      fetchExpertDetails(id);
    }
  }, [id]);

  const fetchExpertDetails = async (expertId: string) => {
    try {
      // Fetch specific expert profile from unified profiles table
      // Note: expertId is profiles.id where account_type = 'expert'
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, expert_bio, expert_specialties, expert_experience_years, expert_credentials, profile_image_url, expert_consultation_rate, expert_rating, expert_total_reviews, expert_availability_status, expert_verified')
        .eq('id', expertId)
        .eq('account_type', 'expert')
        .eq('expert_verified', true)
        .single();

      if (error) throw error;
      setExpert(data);
      
      // Fetch or create consultation product for this expert
      await fetchConsultationProduct(expertId);
    } catch (error) {
      console.error('Error fetching expert details:', error);
      navigate('/experts');
    } finally {
      setLoading(false);
    }
  };

  const fetchConsultationProduct = async (expertId: string) => {
    try {
      // First, get expert data to check availability
      const { data: expertData, error: expertError } = await supabase
        .from('profiles')
        .select('first_name, expert_consultation_rate, expert_availability_status')
        .eq('id', expertId)
        .single();

      if (expertError || !expertData) {
        console.error('Error fetching expert data:', expertError);
        return;
      }

      // Only proceed if expert is available for consultations
      if (expertData.expert_availability_status !== 'available') {
        setConsultationProduct(null);
        return;
      }

      // Try to find existing consultation product for this expert
      let { data: product, error: fetchError } = await supabase
        .from('products')
        .select(`
          *,
          expert:profiles!products_expert_id_fkey(
            id, first_name, profile_image_url
          )
        `)
        .eq('expert_id', expertId)
        .eq('product_type', 'consultation')
        .single();

      // If no consultation product exists, create one
      if (fetchError && fetchError.code === 'PGRST116') {
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            title: `Consultation with ${expertData.first_name}`,
            description: `Book a one-on-one consultation session with ${expertData.first_name}. This expert will reach out to you within 24 hours to schedule your appointment.`,
            product_type: 'consultation',
            price: expertData.expert_consultation_rate || 0, // Use expert's rate or 0 if not set
            expert_id: expertId,
            is_active: true
          })
          .select(`
            *,
            expert:profiles!products_expert_id_fkey(
              id, first_name, profile_image_url
            )
          `)
          .single();

        if (createError) {
          console.error('Error creating consultation product:', createError);
          return;
        }
        product = newProduct;
      } else if (fetchError) {
        console.error('Error fetching consultation product:', fetchError);
        return;
      }

      // Update existing consultation product to ensure it's active (but preserve the price)
      if (product && product.is_active !== true) {
        const { data: updatedProduct, error: updateError } = await supabase
          .from('products')
          .update({
            is_active: true
          })
          .eq('id', product.id)
          .select(`
            *,
            expert:profiles!products_expert_id_fkey(
              id, first_name, profile_image_url
            )
          `)
          .single();

        if (updateError) {
          console.error('Error updating consultation product:', updateError);
        } else {
          product = updatedProduct;
        }
      }

      setConsultationProduct(product);
    } catch (error) {
      console.error('Error with consultation product:', error);
    }
  };

  const handleBookConsultation = () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    
    if (!consultationProduct) {
      console.error('Consultation product not available');
      return;
    }
    
    setPurchaseModalOpen(true);
  };

  const handlePurchaseSuccess = (purchaseId: string) => {
    console.log('Consultation booking successful:', purchaseId);
    // The purchase modal will handle navigation to success page
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-32 mb-8"></div>
            <div className="bg-white rounded-xl p-8 space-y-6">
              <div className="flex items-start gap-6">
                <div className="w-32 h-32 bg-gray-300 rounded-full"></div>
                <div className="flex-1 space-y-4">
                  <div className="h-6 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-300 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!expert) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto text-center">
          <Button onClick={() => navigate('/experts')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Experts
          </Button>
          <p className="mt-4 text-gray-600">Expert not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Main Profile Card */}
        <Card className="bg-white border-none shadow-lg mb-6">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-start gap-6">
              {/* Profile Image */}
              <div className="flex-shrink-0">
                <img
                  src={expert.profile_image_url || '/placeholder.svg'}
                  alt={expert.first_name}
                  className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                />
                <div className="flex items-center justify-center mt-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-1" />
                  <span className="text-sm text-green-600 font-medium">Verified</span>
                </div>
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      {expert.first_name}
                    </h1>
                    <p className="text-xl text-indigo-600 font-semibold mb-3">
                      {expert.expert_specialties?.[0] || 'General Expert'}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                      <div className="flex items-center">
                        <Star className="h-5 w-5 text-yellow-400 mr-1" />
                        <span className="text-lg font-medium">
                          {expert.expert_rating ? expert.expert_rating.toFixed(1) : 'New'}
                        </span>
                        <span className="text-gray-600 ml-1">
                          ({expert.expert_total_reviews || 0} reviews)
                        </span>
                      </div>
                      
                      <div className="flex items-center text-gray-600">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>{expert.expert_experience_years || 0} years experience</span>
                      </div>
                    </div>

                    {/* Availability Status */}
                    <Badge 
                      variant={expert.expert_availability_status === 'available' ? 'default' : 'secondary'}
                      className="mb-4"
                    >
                      {expert.expert_availability_status === 'available' ? 'Available for Consultations' : 'Currently Unavailable'}
                    </Badge>
                  </div>

                  {/* Consultation - Only show if expert is available */}
                  {expert.expert_availability_status === 'available' && (
                    <div className="text-center md:text-right">
                      <div className="bg-indigo-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Consultation</p>
                        <p className="text-lg font-semibold text-indigo-600">
                          {consultationProduct && consultationProduct.price > 0
                            ? `$${consultationProduct.price.toFixed(0)}`
                            : 'Contact for rates'
                          }
                        </p>
                        <Button
                          className="w-full mt-3"
                          onClick={handleBookConsultation}
                        >
                          Book Consultation
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bio */}
                <div className="mt-6">
                  <p className="text-gray-700 leading-relaxed">
                    {expert.expert_bio}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Credentials */}
          {expert.expert_credentials && expert.expert_credentials.length > 0 && (
            <Card className="bg-white border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Award className="h-5 w-5 mr-2 text-indigo-600" />
                  Credentials
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {expert.expert_credentials.map((cred, index) => (
                    <li key={index} className="text-gray-700">
                      • {cred}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Specialties */}
          {expert.expert_specialties && expert.expert_specialties.length > 1 && (
            <Card className="bg-white border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <GraduationCap className="h-5 w-5 mr-2 text-indigo-600" />
                  All Specialties
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {expert.expert_specialties.map((specialty, index) => (
                    <Badge key={index} variant="outline" className="text-sm">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Products Section */}
        <div className="mt-6">
          <ExpertProductsSection
            expertId={expert.id}
            expertName={expert.first_name}
            expertAvailabilityStatus={expert.expert_availability_status}
          />
        </div>

        {/* Purchase Modal */}
        {consultationProduct && (
          <PurchaseModal
            isOpen={purchaseModalOpen}
            onClose={() => setPurchaseModalOpen(false)}
            product={consultationProduct}
            onPurchaseSuccess={handlePurchaseSuccess}
          />
        )}
      </div>
    </div>
  );
};

export default ExpertDetails;