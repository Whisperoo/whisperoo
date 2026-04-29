import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Filter, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  expert_rating: number;
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
  const [hospitalOnly, setHospitalOnly] = useState(false);

  useEffect(() => {
    fetchExperts();
  }, []);

  const fetchExperts = async () => {
    try {
      // Fetch expert profiles from unified profiles table
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, first_name, expert_bio, expert_specialties, expert_experience_years, profile_image_url, expert_consultation_rate, expert_rating, expert_total_reviews, expert_availability_status, expert_verified, expert_profile_visibility, expert_accepts_new_clients, tenant_id",
        ) // ✅ Both corrected: visibility & accepts_new_clients
        .eq("account_type", "expert")
        .eq("expert_verified", true)
        // ✅ TRIPLE FILTER with corrected column names
        .neq("expert_availability_status", "unavailable")
        .eq("expert_profile_visibility", true) // ✅ visibility (not visiability)
        .eq("expert_accepts_new_clients", true) // ✅ accepts_new_clients (not accept_new_clients)
        .order("expert_rating", { ascending: false });

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
    return matchesSearch && matchesSpecialty;
  });

  // SOW 3.1: Tenant-aware expert sorting — hospital experts first
  const expertBoostIds = config?.expert_boost_ids || [];
  const sortedExperts = isHospitalUser && (expertBoostIds.length > 0 || tenant)
    ? [...filteredExperts].sort((a, b) => {
        const aIsBoosted = expertBoostIds.includes(a.id) || (tenant && a.tenant_id === tenant.id);
        const bIsBoosted = expertBoostIds.includes(b.id) || (tenant && b.tenant_id === tenant.id);
        if (aIsBoosted && !bIsBoosted) return -1;
        if (!aIsBoosted && bIsBoosted) return 1;
        return (b.expert_rating || 0) - (a.expert_rating || 0);
      })
    : filteredExperts;

  // SOW 3.5: Apply hospital-only filter if toggled
  const displayExperts = hospitalOnly
    ? sortedExperts.filter(expert => isExpertBoosted(expert))
    : sortedExperts;

  const isExpertBoosted = (expert: ExpertProfile) =>
    isHospitalUser && (
      expertBoostIds.includes(expert.id) ||
      (tenant && expert.tenant_id === tenant.id)
    );

  const specialties = [
    ...new Set(experts.flatMap((expert) => expert.expert_specialties || [])),
  ];

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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {t('experts.title')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('experts.subtitle')}
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={t('experts.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
          <select
            value={selectedSpecialty}
            onChange={(e) => setSelectedSpecialty(e.target.value)}
            className="px-4 w-full md:w-fit py-2 bg-white border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">{t('experts.allSpecialties')}</option>
            {specialties
              .filter((specialty) => specialty && specialty.trim())
              .map((specialty) => (
                <option key={specialty} value={specialty}>
                  {specialty}
                </option>
              ))}
          </select>
          {/* SOW 3.5: Hospital filter toggle — only visible to hospital users */}
          {isHospitalUser && (expertBoostIds.length > 0 || tenant) && (
            <button
              onClick={() => setHospitalOnly(!hospitalOnly)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-all duration-200 whitespace-nowrap ${
                hospitalOnly
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
              }`}
            >
              <Building2 className="w-4 h-4" />
              {hospitalOnly ? t('experts.hospitalOnly') : t('experts.hospitalPartners')}
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-600">
            {displayExperts.length === 1 
              ? t('experts.expertFound', { count: 1 })
              : t('experts.expertsFound', { count: displayExperts.length })
            }
            {isHospitalUser && expertBoostIds.length > 0 && !hospitalOnly && (
              <span className="text-indigo-600 ml-1">
                {t('experts.hospitalPartnersFirst')}
              </span>
            )}
            {hospitalOnly && (
              <span className="text-indigo-600 ml-1">
                {t('experts.showingHospitalOnly')}
              </span>
            )}
          </p>
        </div>

        {/* Expert Cards Grid */}
        {displayExperts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">{t('experts.noExpertsFound')}</p>
              <p className="text-sm">
                {t('experts.tryAdjusting')}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {displayExperts.map((expert) => (
              <Card
                key={expert.id}
                className={`cursor-pointer hover:shadow-lg transition-shadow duration-200 bg-white border-none ${
                  isExpertBoosted(expert) ? 'ring-2 ring-indigo-200' : ''
                }`}
                onClick={() => handleExpertClick(expert.id)}
              >
                <CardContent className="p-6">
                  {/* Hospital Partner Badge */}
                  {isExpertBoosted(expert) && (
                    <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full w-fit">
                      <Building2 className="w-3 h-3" />
                      {t('experts.recommendedBy', { name: config?.branding?.display_name || tenant?.name || 'Hospital' })}
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <img
                      src={expert.profile_image_url || "/placeholder.svg"}
                      alt={expert.first_name}
                      className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-gray-900 truncate">
                        {expert.first_name}
                      </h3>
                      <p className="text-indigo-600 font-medium text-sm">
                        {expert.expert_specialties?.[0] || t('experts.generalExpert')}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center">
                          <span className="text-yellow-400">★</span>
                          <span className="text-sm text-gray-600 ml-1">
                            {expert.expert_rating
                              ? expert.expert_rating.toFixed(1)
                              : t('experts.new')}{" "}
                            ({t('experts.reviews', { count: expert.expert_total_reviews || 0 })})
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm mt-2 line-clamp-2">
                        {getLocalizedBio(expert, i18n.language)}
                      </p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-sm text-gray-500">
                          {t('experts.yearsExperience', { count: expert.expert_experience_years || 0 })}
                        </span>
                        <span className="text-sm font-medium text-indigo-600">
                          {t('experts.bookConsultation')}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpertProfiles;
