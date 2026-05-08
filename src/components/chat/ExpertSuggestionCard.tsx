import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

interface ExpertSuggestion {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  profile_image_url?: string;
  rating: number;
  total_reviews: number;
  consultation_fee: number;
  experience_years?: number;
  location?: string;
  tenant_id?: string | null;
}

interface ExpertSuggestionCardProps {
  expert: ExpertSuggestion;
}

const ExpertSuggestionCard: React.FC<ExpertSuggestionCardProps> = ({ expert }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isHospitalExpert = Boolean(expert.tenant_id);

  const handleViewProfile = () => {
    navigate(`/experts/${expert.id}`);
  };

  return (
    <Card className="bg-white border-none shadow-md hover:shadow-lg transition-shadow duration-200 max-w-sm">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <img
              src={expert.profile_image_url || '/placeholder.svg'}
              alt={expert.name}
              className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-gray-100"
            />
            <div className="flex-1 min-w-0">
              <div className="mb-1">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    isHospitalExpert
                      ? 'border-brand-primary/30 bg-brand-primary/10 text-brand-primary'
                      : 'border-gray-200 bg-gray-100 text-gray-600'
                  }`}
                >
                  {isHospitalExpert
                    ? t('experts.hospitalExpertTag', 'Hospital Expert')
                    : t('experts.whisperooExpertTag', 'Whisperoo Expert')}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm truncate">
                {expert.name}
              </h3>
              <p className="text-action-primary font-medium text-xs">
                {expert.specialty}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <Star className="h-3 w-3 text-yellow-400 fill-current" />
                <span className="text-xs text-gray-600">
                  {expert.rating.toFixed(1)} ({expert.total_reviews} reviews)
                </span>
              </div>
            </div>
          </div>

          {/* Bio */}
          <p className="text-gray-600 text-xs leading-relaxed line-clamp-2">
            {expert.bio}
          </p>

          {/* Action Button */}
          <Button 
            onClick={handleViewProfile}
            className="w-full bg-action-primary hover:bg-action-primary/80 text-action-primary-foreground text-xs py-2 h-8"
          >
            View Full Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpertSuggestionCard;