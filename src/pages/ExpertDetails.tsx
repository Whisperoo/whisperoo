import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Star, Award, GraduationCap, CheckCircle, Building2, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { ExpertProductsSection } from '@/components/expert/ExpertProductsSection';
import { PurchaseModal } from '@/components/products/PurchaseModal';
import { ProductWithDetails } from '@/services/products';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useTranslation } from 'react-i18next';
import { getLocalizedBio } from '@/services/translationService';
import { useToast } from '@/hooks/use-toast';

interface ExpertProfile {
  id: string;
  first_name: string;
  expert_bio: string;
  expert_bio_es?: string | null;
  expert_bio_vi?: string | null;
  expert_specialties: string[];
  expert_experience_years: number;
  expert_credentials: string[];
  profile_image_url: string;
  expert_consultation_rate: number;
  expert_total_reviews: number;
  expert_availability_status: string;
  expert_verified: boolean;
  tenant_id?: string | null;
  inquiry_confirmation_message?: string | null;
  inquiry_prebook_message?: string | null;
}

const ExpertDetails: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { isHospitalUser, tenant, config } = useTenant();
  const { toast } = useToast();
  const [expert, setExpert] = useState<ExpertProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [consultationProduct, setConsultationProduct] = useState<ProductWithDetails | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [showInquiryConfirmation, setShowInquiryConfirmation] = useState(false);
  const [existingBookingStatus, setExistingBookingStatus] = useState<string | null>(null);
  /** After user confirms pre-book modal (inquiry or hospital scheduling flow) */
  const [pendingPreBookModel, setPendingPreBookModel] = useState<'inquiry' | 'hospital' | null>(null);

  const getBookingModel = (product: ProductWithDetails | null): 'direct' | 'inquiry' | 'hospital' => {
    if (!product) return 'direct';
    const configuredModel = (product as any).booking_model as string | null | undefined;
    if (configuredModel === 'hospital' || configuredModel === 'inquiry') {
      return configuredModel;
    }
    // Safety guard: consultation with no payable amount should never enter Stripe flow,
    // even if legacy data still says `booking_model = direct`.
    if (product.product_type === 'consultation' && Number(product.price || 0) <= 0) {
      return 'inquiry';
    }
    if (configuredModel === 'direct') {
      return 'direct';
    }
    // Safe fallback for legacy products without booking_model.
    return product.price > 0 ? 'direct' : 'inquiry';
  };

  useEffect(() => {
    if (id) {
      fetchExpertDetails(id);
      if (user) checkExistingBooking(id);
    }
  }, [id, user]);

  /** Hospital programs: block other hospitals' experts and tenant-disabled experts */
  useEffect(() => {
    if (!expert || !isHospitalUser || !tenant?.id) return;
    const disabled = config?.disabled_expert_ids ?? [];
    const wrongHospital = Boolean(expert.tenant_id && expert.tenant_id !== tenant.id);
    const hiddenForTenant = disabled.includes(expert.id);
    if (!wrongHospital && !hiddenForTenant) return;
    toast({
      title: t('experts.notInProgramTitle', 'Not available'),
      description: t(
        'experts.notInProgramDesc',
        'This expert is not part of your hospital program.',
      ),
      variant: 'destructive',
    });
    navigate('/experts');
  }, [expert, isHospitalUser, tenant?.id, config?.disabled_expert_ids, navigate, toast, t]);

  const fetchExpertDetails = async (expertId: string) => {
    try {
      // Fetch specific expert profile from unified profiles table
      // Note: expertId is profiles.id where account_type = 'expert'
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, expert_bio, expert_bio_es, expert_bio_vi, expert_specialties, expert_experience_years, expert_credentials, profile_image_url, expert_consultation_rate, expert_total_reviews, expert_availability_status, expert_verified, tenant_id, inquiry_confirmation_message, inquiry_prebook_message')
        .eq('id', expertId)
        .eq('account_type', 'expert')
        .eq('expert_verified', true)
        .single();

      if (error) throw error;
      if (isHospitalUser && tenant?.id) {
        const disabled = config?.disabled_expert_ids ?? [];
        if ((data.tenant_id && data.tenant_id !== tenant.id) || disabled.includes(data.id)) {
          toast({
            title: t('experts.notInProgramTitle', 'Not available'),
            description: t(
              'experts.notInProgramDesc',
              'This expert is not part of your hospital program.',
            ),
            variant: 'destructive',
          });
          navigate('/experts');
          return;
        }
      }
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

  const checkExistingBooking = async (expertId: string) => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('consultation_bookings')
        .select('status')
        .eq('user_id', user.id)
        .eq('expert_id', expertId)
        .in('status', ['pending', 'confirmed'])
        .limit(1)
        .maybeSingle();

      if (data) {
        setExistingBookingStatus(data.status);
      }
    } catch (err) {
      console.error('Error checking existing booking:', err);
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
            booking_model: (expertData.expert_consultation_rate || 0) > 0 ? 'direct' : 'inquiry',
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

    if (!consultationProduct || !expert) {
      console.error('Consultation product or expert not available');
      return;
    }

    const model = getBookingModel(consultationProduct);
    if (model === 'direct') {
      setPurchaseModalOpen(true);
      return;
    }

    setPendingPreBookModel(model);
  };

  const runHospitalBookingThenScheduleModal = async () => {
    if (!user || !consultationProduct || !expert) return;
    setInquirySubmitting(true);
    try {
      const { error: hospitalBookingError } = await supabase
        .from('consultation_bookings')
        .insert({
          user_id: user.id,
          user_email: user.email || '',
          user_name: profile?.first_name || 'User',
          expert_id: expert.id,
          expert_name: expert.first_name,
          product_id: consultationProduct.id,
          appointment_name: consultationProduct.title || `Consultation with ${expert.first_name}`,
          booking_type: 'inquiry',
          amount_paid: 0,
          payment_status: 'free',
          resource_type: 'hospital',
          status: 'pending',
        });

      if (hospitalBookingError) {
        console.error('Hospital booking record error:', hospitalBookingError);
      }
    } catch (err) {
      console.error('Hospital booking record error:', err);
    } finally {
      setInquirySubmitting(false);
    }
    setShowScheduleModal(true);
  };

  const runInquiryBookingThenConfirmation = async () => {
    if (!user || !consultationProduct || !expert) return;
    setInquirySubmitting(true);
    try {
      const { error: bookingError } = await supabase
        .from('consultation_bookings')
        .insert({
          user_id: user.id,
          user_email: user.email || '',
          user_name: profile?.first_name || 'User',
          expert_id: expert.id,
          expert_name: expert.first_name,
          product_id: consultationProduct.id,
          appointment_name: consultationProduct.title || `Consultation with ${expert.first_name}`,
          booking_type: 'inquiry',
          amount_paid: 0,
          payment_status: 'free',
          resource_type: expert.tenant_id ? 'hospital' : 'whisperoo',
          status: 'pending',
        });

      if (bookingError) throw bookingError;

      setExistingBookingStatus('pending');
      setShowInquiryConfirmation(true);
    } catch (err: unknown) {
      console.error('Inquiry booking error:', err);
      toast({
        title: 'Error',
        description: 'Failed to submit your request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setInquirySubmitting(false);
    }
  };

  const handlePreBookConfirm = async () => {
    if (!pendingPreBookModel) return;
    const model = pendingPreBookModel;
    setPendingPreBookModel(null);
    if (model === 'hospital') {
      await runHospitalBookingThenScheduleModal();
    } else {
      await runInquiryBookingThenConfirmation();
    }
  };

  const handlePurchaseSuccess = (purchaseId: string) => {
    console.log('Consultation booking successful:', purchaseId);
    // The purchase modal will handle navigation to success page
  };

  const translateSpecialty = (specialty: string) => {
    if (!specialty) return '';
    
    // Convert e.g. "Pediatric & Family Chiropractor" to "pediatricFamilyChiropractor"
    const key = specialty
      .replace(/[^a-zA-Z0-9 ]/g, '') // remove special characters like &
      .split(' ')
      .filter(Boolean)
      .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    return t(`experts.specialties.${key}`, specialty);
  };

  const getExpertDisplayTitle = (): string => {
    const raw = expert?.expert_specialties?.[0] || '';
    return translateSpecialty(raw) || t('experts.generalExpert');
  };

  const getExpertNameAndTitle = (): string =>
    expert ? `${expert.first_name}, ${getExpertDisplayTitle()}` : '';

  const hospitalPrebookOverride =
    consultationProduct &&
    (consultationProduct as { hospital_prebook_message?: string | null }).hospital_prebook_message?.trim();

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
            {t('experts.backToExperts')}
          </Button>
          <p className="mt-4 text-gray-600">{t('experts.expertNotFound')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto w-full overflow-hidden">

        {/* Main Profile Card */}
        <Card className="bg-white border-none shadow-lg mb-6 overflow-hidden">
          <CardContent className="p-5 sm:p-8">
            <div className="flex flex-col items-center sm:items-start sm:flex-row gap-6">
              {/* Profile Image */}
              <div className="flex flex-col items-center flex-shrink-0">
                {expert.profile_image_url ? (
                  <img
                    src={expert.profile_image_url}
                    alt={expert.first_name}
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                    onError={(e) => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement)?.style.setProperty('display', 'flex'); }}
                  />
                ) : null}
                <div
                  className="w-32 h-32 rounded-full border-4 border-white shadow-lg bg-indigo-100 items-center justify-center text-indigo-700 font-bold text-4xl"
                  style={{ display: expert.profile_image_url ? 'none' : 'flex' }}
                >
                  {expert.first_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex items-center justify-center mt-3 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-xs text-green-600 font-bold">{t('experts.verified')}</span>
                </div>
              </div>

              {/* Profile Info & Booking Box Container */}
              <div className="flex-1 w-full text-center sm:text-left">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-6 w-full">
                  
                  {/* Left Column: Info & Disclaimer */}
                  <div className="flex-1 w-full">
                    {expert.tenant_id ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-brand-primary/10 text-brand-dark border border-brand-primary/30 text-xs font-semibold rounded mb-2">
                        {t('experts.hospitalExpertTag', 'Hospital Expert')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-brand-primary border border-brand-primary/20 text-xs font-semibold rounded mb-2">
                        {t('experts.whisperooExpertTag', 'Whisperoo Expert')}
                      </span>
                    )}
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 break-words">
                      {expert.first_name}
                    </h1>
                    <p className="text-lg sm:text-xl text-indigo-600 font-semibold mb-3 break-words">
                      {translateSpecialty(expert.expert_specialties?.[0] || '') || t('experts.generalExpert')}
                    </p>
                    
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mb-4">
                      <div className="flex items-center text-gray-500 text-sm font-medium">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>{t('experts.yearsExperience', { count: expert.expert_experience_years || 0 })}</span>
                      </div>
                    </div>

                    {/* Availability Status */}
                    <div className="flex justify-center sm:justify-start mb-4">
                      <Badge 
                        variant={expert.expert_availability_status === 'available' ? 'default' : 'secondary'}
                      >
                        {expert.expert_availability_status === 'available' ? t('experts.availableForConsultations') : t('experts.currentlyUnavailable')}
                      </Badge>
                    </div>

                    {/* Disclaimer */}
                    <div className="mt-4 border border-brand-primary bg-white p-3 rounded-md max-w-lg shadow-sm">
                      <p className="text-brand-primary text-sm font-medium">
                        {expert.tenant_id 
                          ? t('experts.hospitalDisclaimer', 'This expert is affiliated with a hospital partner.') 
                          : t('experts.whisperooDisclaimer', 'Whisperoo connects you with independent providers who are not employed by Whisperoo or endorsed by any hospital partner.')}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Consultation Booking Box */}
                  {expert.expert_availability_status === 'available' && (
                    <div className="w-full sm:w-auto flex-shrink-0">
                      <div className="bg-indigo-50 rounded-xl p-5 w-full sm:w-[280px]">
                        <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1 opacity-70">{t('experts.consultation')}</p>
                        {/* Price: hide for inquiry and hospital models */}
                        {getBookingModel(consultationProduct) === 'direct' ? (
                          <p className="text-2xl font-bold text-indigo-600 mb-4">
                            {consultationProduct && consultationProduct.price > 0
                              ? `$${consultationProduct.price.toFixed(0)}`
                              : t('experts.contactForRates')
                            }
                          </p>
                        ) : (
                          <p className="text-sm text-indigo-500 mb-4 font-medium">
                            {getBookingModel(consultationProduct) === 'hospital'
                              ? 'Schedule through your hospital'
                              : 'No upfront payment required'}
                          </p>
                        )}
                        <Button
                          className={`w-full shadow-md font-bold h-11 ${
                            existingBookingStatus
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-700'
                          }`}
                          onClick={handleBookConsultation}
                          disabled={inquirySubmitting || !!existingBookingStatus}
                        >
                          {inquirySubmitting
                            ? 'Submitting...'
                            : existingBookingStatus === 'confirmed'
                              ? '✓ Appointment Confirmed'
                              : existingBookingStatus === 'pending'
                                ? '⏳ Request Pending'
                                : getBookingModel(consultationProduct) === 'inquiry' ||
                                    getBookingModel(consultationProduct) === 'hospital'
                                  ? t('experts.bookAppointment')
                                  : t('experts.bookConsultation')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bio */}
                <div className="mt-6 border-t border-gray-100 pt-6">
                  <p className="text-gray-700 leading-relaxed text-sm sm:text-base break-words">
                    {getLocalizedBio(expert, i18n.language)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SOW 3.3: Hospital Partner Direct Contact Section */}
        {isHospitalUser && expert && tenant && config && (
          (config.expert_boost_ids?.includes(expert.id) || expert.tenant_id === tenant.id)
        ) && (
          <Card className="bg-indigo-50 border-indigo-200 shadow-lg mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">
                    {t('experts.partner', { name: config.branding?.display_name || tenant.name })}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {t('experts.partOfCareNetwork')}
                  </p>
                </div>
              </div>

              {config.departments && config.departments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-700 mb-2">{t('experts.contactHospitalDirectly')}</p>
                  <div className="flex flex-wrap gap-3">
                    {config.departments.map((dept, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {dept.phone && (
                          <a
                            href={`tel:${dept.phone.replace(/[^0-9]/g, '')}`}
                            className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm"
                          >
                            <Phone className="w-4 h-4 text-indigo-500" />
                            {dept.name}: {dept.phone}
                          </a>
                        )}
                        {dept.email && (
                          <a
                            href={`mailto:${dept.email}`}
                            className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm"
                          >
                            <Mail className="w-4 h-4 text-indigo-500" />
                            {t('experts.emailDepartment', { name: dept.name })}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Additional Information */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Credentials */}
          {expert.expert_credentials && expert.expert_credentials.length > 0 && (
            <Card className="bg-white border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Award className="h-5 w-5 mr-2 text-indigo-600" />
                  {t('experts.credentials')}
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
                  {t('experts.allSpecialties')}
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

        {/* Pre-book confirmation (inquiry & hospital resource flows) */}
        {pendingPreBookModel && expert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="px-6 pt-6 pb-3">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t('experts.preBook.title')}
                  </h3>
                  {pendingPreBookModel === 'hospital' && (
                    <Badge className="bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100">
                      {t('experts.hospitalResourceTag')}
                    </Badge>
                  )}
                </div>
                <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
                  {pendingPreBookModel === 'inquiry' && expert.inquiry_prebook_message?.trim() ? (
                    <p className="whitespace-pre-wrap">{expert.inquiry_prebook_message.trim()}</p>
                  ) : pendingPreBookModel === 'hospital' && hospitalPrebookOverride ? (
                    <p className="whitespace-pre-wrap">{hospitalPrebookOverride}</p>
                  ) : (
                    <>
                      <p>
                        {pendingPreBookModel === 'inquiry'
                          ? t('experts.preBook.inquiryIntro', { expertNameAndTitle: getExpertNameAndTitle() })
                          : t('experts.preBook.hospitalIntro', { expertNameAndTitle: getExpertNameAndTitle() })}
                      </p>
                      <p>
                        {pendingPreBookModel === 'inquiry'
                          ? t('experts.preBook.inquiryOutreach', { firstName: expert.first_name })
                          : t('experts.preBook.hospitalOutreach', { firstName: expert.first_name })}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPendingPreBookModel(null)}
                  disabled={inquirySubmitting}
                  className="font-semibold w-full sm:w-auto"
                >
                  {t('experts.preBook.cancel')}
                </Button>
                <Button
                  onClick={() => void handlePreBookConfirm()}
                  disabled={inquirySubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold w-full sm:w-auto"
                >
                  {inquirySubmitting ? t('experts.preBook.submitting') : t('experts.bookAppointment')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* How to Schedule Modal (hospital resources) */}
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">How to Schedule</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {expert?.first_name ? `Scheduling with ${expert.first_name}` : 'Scheduling Instructions'}
                </p>
              </div>
              <div className="px-6 py-5">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <p className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">
                    {(consultationProduct as any)?.how_to_schedule
                      || 'Please contact your hospital care team for scheduling details. They will coordinate your appointment directly.'}
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowScheduleModal(false)}
                  className="font-semibold"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Inquiry Confirmation Modal */}
        {showInquiryConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Request Created</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Your consultation request with <span className="font-medium text-gray-700">{expert?.first_name}</span> has been submitted.
                </p>
              </div>

              {/* Custom or default message */}
              <div className="px-6 pb-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <p className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">
                    {expert?.inquiry_confirmation_message
                      || `We'll notify ${expert?.first_name || 'the expert'} directly. They'll reach out within 24–48 hours to coordinate a time that works for you.`}
                  </p>
                </div>
              </div>

              {/* Status info */}
              <div className="px-6 pb-5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Status:</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <Button
                  onClick={() => setShowInquiryConfirmation(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6"
                >
                  Got it
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpertDetails;