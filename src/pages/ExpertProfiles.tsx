import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

interface ExpertProfile {
  id: string;
  first_name: string;
  expert_bio: string;
  expert_specialties: string[];
  expert_experience_years: number;
  profile_image_url: string;
  expert_consultation_rate: number;
  expert_rating: number;
  expert_total_reviews: number;
  expert_availability_status: string;
  expert_verified: boolean;
}

const ExpertProfiles: React.FC = () => {
  const navigate = useNavigate();
  const [experts, setExperts] = useState<ExpertProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");

  useEffect(() => {
    fetchExperts();
  }, []);

  const fetchExperts = async () => {
    try {
      // Fetch expert profiles from unified profiles table
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, first_name, expert_bio, expert_specialties, expert_experience_years, profile_image_url, expert_consultation_rate, expert_rating, expert_total_reviews, expert_availability_status, expert_verified",
        )
        .eq("account_type", "expert")
        .eq("expert_verified", true)
        // ✅ FIX: Only show experts who are NOT unavailable
        .neq("expert_availability_status", "unavailable")
        .order("expert_rating", { ascending: false });

      if (error) throw error;
      setExperts(data || []);
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
            Whisperoo Verified Experts
          </h1>
          <p className="text-gray-600 mt-1">
            Connect with board-certified professionals who specialize in child
            and family health
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by name, specialty, or expertise..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
          <select
            value={selectedSpecialty}
            onChange={(e) => setSelectedSpecialty(e.target.value)}
            className="px-4 py-2 bg-white border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Specialties</option>
            {specialties
              .filter((specialty) => specialty && specialty.trim())
              .map((specialty) => (
                <option key={specialty} value={specialty}>
                  {specialty}
                </option>
              ))}
          </select>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-600">
            {filteredExperts.length} expert
            {filteredExperts.length !== 1 ? "s" : ""} found
          </p>
        </div>

        {/* Expert Cards Grid */}
        {filteredExperts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No experts found matching your criteria</p>
              <p className="text-sm">
                Try adjusting your search or filter options
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredExperts.map((expert) => (
              <Card
                key={expert.id}
                className="cursor-pointer hover:shadow-lg transition-shadow duration-200 bg-white border-none"
                onClick={() => handleExpertClick(expert.id)}
              >
                <CardContent className="p-6">
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
                        {expert.expert_specialties?.[0] || "General Expert"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center">
                          <span className="text-yellow-400">★</span>
                          <span className="text-sm text-gray-600 ml-1">
                            {expert.expert_rating
                              ? expert.expert_rating.toFixed(1)
                              : "New"}{" "}
                            ({expert.expert_total_reviews || 0} reviews)
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm mt-2 line-clamp-2">
                        {expert.expert_bio}
                      </p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-sm text-gray-500">
                          {expert.expert_experience_years || 0} years experience
                        </span>
                        <span className="text-sm font-medium text-indigo-600">
                          Book consultation
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
