import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/contexts/TenantContext";
import { useTranslation } from "react-i18next";
import { getLocalizedBio } from "@/services/translationService";

interface ExpertProfile {
  id: string;
  first_name: string;
  expert_bio: string;
  expert_bio_es?: string | null;
  expert_bio_vi?: string | null;
  expert_specialties: string[];
  expert_experience_years: number;
  profile_image_url: string;
  expert_consultation_rate: number;
  expert_total_reviews: number;
  expert_availability_status: string;
  expert_verified: boolean;
  tenant_id?: string | null;
}

const ExpertProfiles: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isHospitalUser, tenant, config } = useTenant();
  const [experts, setExperts] = useState<ExpertProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'whisperoo' | 'hospital'>('whisperoo');

  useEffect(() => {
    fetchExperts();
  }, []);

  const fetchExperts = async () => {
    try {
      // Fetch expert profiles from unified profiles table
      const { data, error } = await supabase
        .from("profiles")
        .select(
         "id, first_name, expert_bio, expert_bio_es, expert_bio_vi, expert_specialties, expert_experience_years, profile_image_url, expert_consultation_rate, expert_total_reviews, expert_availability_status, expert_verified, expert_profile_visibility, expert_accepts_new_clients, tenant_id",
        )
        .eq("account_type", "expert")
        .eq("expert_verified", true)
        .neq("expert_availability_status", "unavailable")
        // Treat NULL as enabled for legacy experts created before these flags existed
        .not("expert_profile_visibility", "eq", false)
        .not("expert_accepts_new_clients", "eq", false)
        .order("first_name", { ascending: true });

      if (error) throw error;
      setExperts(data || []);

      console.log(`Found ${data?.length || 0} visible experts after filtering`);
    } catch (error) {
      console.error("Error fetching experts:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredExperts = experts.filter((expert) => {
    const matchesSearch =
      expert.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (expert.expert_specialties || []).some((specialty) =>
        specialty.toLowerCase().includes(searchTerm.toLowerCase()),
      ) ||
      expert.expert_bio?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpecialty =
      !selectedSpecialty ||
      (expert.expert_specialties || []).includes(selectedSpecialty);
    
    // Tag filter matching
    const matchesTags = activeTags.length === 0 || activeTags.some(tag => {
      // Create a normalized list of tags for this expert
      const expertTags = [
        ...(expert.expert_specialties || []),
        expert.expert_bio || '',
        expert.first_name || ''
      ].map(s => s.toLowerCase());
      
      const normalizedSearchTag = tag.toLowerCase();
      return expertTags.some(t => t.includes(normalizedSearchTag));
    });

    return matchesSearch && matchesSpecialty && matchesTags;
  });

  // SOW 3.1: Tenant-aware expert sorting — hospital experts first
  const expertBoostIds = config?.expert_boost_ids || [];
  const sortedExperts = isHospitalUser && (expertBoostIds.length > 0 || tenant)
    ? [...filteredExperts].sort((a, b) => {
        const aIsBoosted = expertBoostIds.includes(a.id) || (tenant && a.tenant_id === tenant.id);
        const bIsBoosted = expertBoostIds.includes(b.id) || (tenant && b.tenant_id === tenant.id);
        if (aIsBoosted && !bIsBoosted) return -1;
        if (!aIsBoosted && bIsBoosted) return 1;
        return 0;
      })
    : filteredExperts;

  const isExpertBoosted = (expert: ExpertProfile) =>
    isHospitalUser && (
      expertBoostIds.includes(expert.id) ||
      (tenant && expert.tenant_id === tenant.id)
    );

  const specialties = [
    ...new Set(experts.flatMap((expert) => expert.expert_specialties || [])),
  ];

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

  // Tab-based display: whisperoo = all experts, hospital = boosted/affiliated only
  const whisperooExperts = sortedExperts;
  const hospitalExperts = isHospitalUser
    ? sortedExperts.filter(expert => isExpertBoosted(expert))
    : [];

  const displayExperts = activeTab === 'hospital' ? hospitalExperts : whisperooExperts;

  const handleExpertClick = (expertId: string) => {
    navigate(`/experts/${expertId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-64 mb-8"></div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-6 space-y-4">
                  <div className="w-20 h-20 bg-gray-300 rounded-full"></div>
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-300 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto w-full overflow-hidden">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
            {t('experts.title')}
          </h1>
          <p className="text-sm sm:text-base text-gray-500 mt-2 max-w-2xl">
            {t('experts.subtitle')}
          </p>
        </div>

        {/* Search and Specialty Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={t('experts.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 bg-white border-gray-200 h-12 rounded-xl text-sm focus:ring-brand-primary"
            />
          </div>
          <select
            value={selectedSpecialty}
            onChange={(e) => setSelectedSpecialty(e.target.value)}
            className="px-4 w-full sm:w-64 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary h-12 shadow-sm appearance-none cursor-pointer"
          >
            <option value="">{t('experts.allSpecialties')}</option>
            {specialties
              .filter((specialty) => specialty && specialty.trim())
              .map((specialty) => (
                <option key={specialty} value={specialty}>
                  {translateSpecialty(specialty)}
                </option>
              ))}
          </select>
        </div>

        {/* ── Content Label Filter Chips ── */}
        {(() => {
          const LABELS = [
            { label: t('onboarding.topics.babyFeeding', 'Baby Feeding'),         slug: 'Baby Feeding' },
            { label: t('onboarding.topics.pelvicFloor', 'Pelvic Floor'),          slug: 'Pelvic Floor' },
            { label: t('onboarding.topics.sleepCoaching', 'Sleep Coaching'),        slug: 'Sleep Coaching' },
            { label: t('onboarding.topics.nervousSystem', 'Nervous System'),        slug: 'Nervous System Regulation' },
            { label: t('onboarding.topics.nutrition', 'Nutrition'),             slug: 'Nutrition' },
            { label: t('onboarding.topics.pediatricDentistry', 'Pediatric Dentistry'),   slug: 'Pediatric Dentistry' },
            { label: t('onboarding.topics.lifestyleCoaching', 'Lifestyle'),             slug: 'Lifestyle Coaching' },
            { label: t('onboarding.topics.fitnessYoga', 'Fitness & Yoga'),        slug: 'Fitness/yoga' },
            { label: t('onboarding.topics.backToWork', 'Back to Work'),          slug: 'Back to Work' },
            { label: t('onboarding.topics.postpartumTips', 'Postpartum'),            slug: 'Postpartum Tips' },
            { label: t('onboarding.topics.prenatalTips', 'Prenatal'),              slug: 'Prenatal Tips' },
          ];
          return (
            <div className="flex flex-wrap gap-2 pt-1 pb-6">
              {LABELS.map(({ label, slug }) => (
                <button
                  key={slug}
                  onClick={() => {
                    setActiveTags(prev => 
                      prev.includes(slug) ? prev.filter(t => t !== slug) : [...prev, slug]
                    );
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    activeTags.includes(slug)
                      ? 'bg-[#1C3263] text-white border-[#1C3263] shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#1C3263] hover:text-[#1C3263]'
                  }`}
                >
                  {label}
                </button>
              ))}
              {activeTags.length > 0 && (
                <button
                  onClick={() => setActiveTags([])}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
                >
                  {t('products.clearSearch', 'Clear labels')}
                </button>
              )}
            </div>
          );
        })()}

        {/* Tabs: Whisperoo Experts / Hospital Experts */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'whisperoo' | 'hospital')}
          className="w-full"
        >
          <TabsList className="w-full sm:w-auto mb-2 bg-gray-100 rounded-xl p-1">
            <TabsTrigger
              value="whisperoo"
              className="flex-1 sm:flex-none rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-sm"
            >
              {t('experts.tabWhisperoo')}
            </TabsTrigger>
            {isHospitalUser && (expertBoostIds.length > 0 || tenant) && (
              <TabsTrigger
                value="hospital"
                className="flex-1 sm:flex-none rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-sm"
              >
                <Building2 className="w-3.5 h-3.5 mr-1.5 inline-block" />
                {t('experts.tabHospital')}
              </TabsTrigger>
            )}
          </TabsList>

          {/* Whisperoo Experts Tab */}
          <TabsContent value="whisperoo" className="mt-0">
            {/* Disclaimer */}
            <p className="text-xs text-brand-primary/80 font-medium mb-4 leading-relaxed">
              {t('experts.whisperooDisclaimer')}
            </p>

            {/* Results Count */}
            <div className="mb-4 flex items-center border-b border-gray-100 pb-3">
              <p className="text-xs sm:text-sm font-semibold text-gray-500">
                {whisperooExperts.length === 1
                  ? t('experts.expertFound', { count: 1 })
                  : t('experts.expertsFound', { count: whisperooExperts.length })}
              </p>
            </div>

            <ExpertGrid
              experts={whisperooExperts}
              isExpertBoosted={isExpertBoosted}
              handleExpertClick={handleExpertClick}
              translateSpecialty={translateSpecialty}
              i18n={i18n}
              t={t}
            />
          </TabsContent>

          {/* Hospital Experts Tab */}
          {isHospitalUser && (expertBoostIds.length > 0 || tenant) && (
            <TabsContent value="hospital" className="mt-0">
              {/* Results Count */}
              <div className="mb-4 flex items-center border-b border-gray-100 pb-3">
                <p className="text-xs sm:text-sm font-semibold text-gray-500">
                  {hospitalExperts.length === 1
                    ? t('experts.expertFound', { count: 1 })
                    : t('experts.expertsFound', { count: hospitalExperts.length })}
                </p>
                <span className="ml-auto text-[10px] sm:text-xs font-bold text-brand-primary uppercase tracking-wider">
                  {t('experts.showingHospitalOnly')}
                </span>
              </div>

              <ExpertGrid
                experts={hospitalExperts}
                isExpertBoosted={isExpertBoosted}
                handleExpertClick={handleExpertClick}
                translateSpecialty={translateSpecialty}
                i18n={i18n}
                t={t}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

// ── Shared expert card grid ────────────────────────────────────────────────────
interface ExpertGridProps {
  experts: any[];
  isExpertBoosted: (e: any) => boolean;
  handleExpertClick: (id: string) => void;
  translateSpecialty: (s: string) => string;
  i18n: any;
  t: any;
}

const ExpertGrid: React.FC<ExpertGridProps> = ({
  experts,
  isExpertBoosted,
  handleExpertClick,
  translateSpecialty,
  i18n,
  t,
}) => {
  if (experts.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="text-gray-500 mb-4">
          <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">{t('experts.noExpertsFound')}</p>
          <p className="text-sm">{t('experts.tryAdjusting')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
      {experts.map((expert) => (
        <Card
          key={expert.id}
          className={`cursor-pointer hover:shadow-lg transition-shadow duration-200 bg-white border-none overflow-hidden ${
            isExpertBoosted(expert) ? 'ring-2 ring-indigo-200' : ''
          }`}
          onClick={() => handleExpertClick(expert.id)}
        >
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-row items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0">
                {expert.profile_image_url ? (
                  <img
                    src={expert.profile_image_url}
                    alt={expert.first_name}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-sm"
                    onError={(e) => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement)?.style.setProperty('display', 'flex'); }}
                  />
                ) : null}
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex-shrink-0 bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl"
                  style={{ display: expert.profile_image_url ? 'none' : 'flex' }}
                >
                  {expert.first_name?.[0]?.toUpperCase() ?? '?'}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base sm:text-lg text-gray-900 leading-tight mb-1 break-words">
                  {expert.first_name}
                </h3>
                <p className="text-indigo-600 font-semibold text-xs sm:text-sm mb-1 break-words">
                  {translateSpecialty(expert.expert_specialties?.[0] || '') || t('experts.generalExpert')}
                </p>
                <p className="text-gray-600 text-xs leading-relaxed line-clamp-3 mb-3 break-words">
                  {getLocalizedBio(expert, i18n.language)}
                </p>

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
                  <span className="text-[10px] sm:text-xs text-gray-500 font-medium">
                    {t('experts.yearsExperience', { count: expert.expert_experience_years || 0 })}
                  </span>
                  <span className="text-[11px] sm:text-sm font-bold text-indigo-600 flex items-center gap-1">
                    {t('experts.bookConsultation')}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ExpertProfiles;
