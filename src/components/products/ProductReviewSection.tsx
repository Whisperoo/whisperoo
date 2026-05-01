import React, { useState, useEffect } from "react";
import { Star, Loader2, CheckCircle, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { format, parseISO } from "date-fns";

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  is_verified_purchase: boolean;
  created_at: string;
  user_id: string;
  reviewer_name?: string;
  reviewer_image?: string;
}

interface ProductReviewSectionProps {
  productId: string;
  isPurchased: boolean;
}

// ── Star Rating Input ──────────────────────────────────────────────────────

const StarInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  hoveredStar: number;
  onHover: (v: number) => void;
  onLeave: () => void;
}> = ({ value, onChange, hoveredStar, onHover, onLeave }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        className="focus:outline-none transition-transform hover:scale-110"
        onClick={() => onChange(star)}
        onMouseEnter={() => onHover(star)}
        onMouseLeave={onLeave}
      >
        <Star
          className={`h-7 w-7 transition-colors ${
            star <= (hoveredStar || value)
              ? "fill-amber-400 text-amber-400"
              : "text-gray-300"
          }`}
        />
      </button>
    ))}
  </div>
);

// ── Static Star Display ────────────────────────────────────────────────────

const StarDisplay: React.FC<{ rating: number; size?: string }> = ({
  rating,
  size = "h-4 w-4",
}) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={`${size} ${
          star <= rating ? "fill-amber-400 text-amber-400" : "text-gray-200"
        }`}
      />
    ))}
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────

export const ProductReviewSection: React.FC<ProductReviewSectionProps> = ({
  productId,
  isPurchased,
}) => {
  const { user } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Form state
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [hoveredStar, setHoveredStar] = useState(0);

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      // Fetch reviews with reviewer profile info
      const { data, error } = await supabase
        .from("product_reviews")
        .select(`
          id,
          rating,
          review_text,
          is_verified_purchase,
          created_at,
          user_id,
          profiles:user_id (first_name, profile_image_url)
        `)
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: Review[] = (data || []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        review_text: r.review_text,
        is_verified_purchase: r.is_verified_purchase,
        created_at: r.created_at,
        user_id: r.user_id,
        reviewer_name: r.profiles?.first_name || "User",
        reviewer_image: r.profiles?.profile_image_url || null,
      }));

      setReviews(mapped);

      // Check if the current user already left a review
      if (user) {
        const mine = mapped.find((r) => r.user_id === user.id);
        if (mine) {
          setUserReview(mine);
          setRating(mine.rating);
          setReviewText(mine.review_text || "");
        }
      }
    } catch (e) {
      console.error("Failed to load reviews:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || rating === 0) return;

    setSubmitting(true);
    try {
      if (userReview) {
        // Update existing review
        const { error } = await supabase
          .from("product_reviews")
          .update({
            rating,
            review_text: reviewText.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userReview.id);

        if (error) throw error;
        toast.success("Review updated!");
      } else {
        // Insert new review
        const { error } = await supabase.from("product_reviews").insert({
          product_id: productId,
          user_id: user.id,
          rating,
          review_text: reviewText.trim() || null,
          is_verified_purchase: isPurchased,
        });

        if (error) throw error;
        toast.success("Review submitted! Thank you.");
      }

      setEditMode(false);
      await fetchReviews();
    } catch (e: any) {
      console.error("Review submit error:", e);
      toast.error("Failed to submit review", {
        description: e.message || "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  const canReview = !!user; // anyone logged in can review; verified badge shown only for purchasers
  const showForm = canReview && (editMode || !userReview);

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <Card className="border-0 shadow-md mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <MessageSquare className="h-4 w-4 text-indigo-500" />
          Reviews
          {reviews.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {reviews.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Bar */}
        {reviews.length > 0 && (
          <div className="flex gap-6 items-center p-4 bg-gray-50 rounded-xl">
            <div className="text-center shrink-0">
              <div className="text-4xl font-bold text-gray-900">
                {avgRating.toFixed(1)}
              </div>
              <StarDisplay rating={Math.round(avgRating)} size="h-4 w-4" />
              <p className="text-xs text-gray-400 mt-1">
                {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </p>
            </div>
            <div className="flex-1 space-y-1.5">
              {ratingCounts.map(({ star, count }) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-3">{star}</span>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all"
                      style={{
                        width:
                          reviews.length > 0
                            ? `${(count / reviews.length) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-3">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit / Edit Form */}
        {canReview && (
          <div>
            {userReview && !editMode ? (
              // Show user's existing review with edit option
              <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">
                      Your review
                    </span>
                    {userReview.is_verified_purchase && (
                      <Badge className="text-xs gap-1 bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="h-3 w-3" /> Verified Purchase
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-indigo-600 h-7 text-xs"
                    onClick={() => setEditMode(true)}
                  >
                    Edit
                  </Button>
                </div>
                <StarDisplay rating={userReview.rating} />
                {userReview.review_text && (
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                    {userReview.review_text}
                  </p>
                )}
              </div>
            ) : (
              // Review form
              <form onSubmit={handleSubmit} className="space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  {userReview ? "Edit your review" : "Leave a review"}
                </p>
                <StarInput
                  value={rating}
                  onChange={setRating}
                  hoveredStar={hoveredStar}
                  onHover={setHoveredStar}
                  onLeave={() => setHoveredStar(0)}
                />
                <Textarea
                  placeholder="Share your experience (optional)…"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={rating === 0 || submitting}
                    className="gap-2"
                  >
                    {submitting && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    {userReview ? "Update" : "Submit Review"}
                  </Button>
                  {editMode && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditMode(false);
                        setRating(userReview?.rating || 0);
                        setReviewText(userReview?.review_text || "");
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}

        {/* Reviews List */}
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No reviews yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-4 divide-y divide-gray-50">
            {reviews
              .filter((r) => !user || r.user_id !== user.id) // hide own review here (shown above)
              .map((review) => (
                <div key={review.id} className="pt-4 first:pt-0">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={review.reviewer_image || undefined} />
                      <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                        {review.reviewer_name?.charAt(0)?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">
                          {review.reviewer_name}
                        </span>
                        {review.is_verified_purchase && (
                          <Badge className="text-xs gap-1 py-0 bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="h-3 w-3" /> Verified
                          </Badge>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">
                          {format(parseISO(review.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                      <StarDisplay rating={review.rating} size="h-3.5 w-3.5" />
                      {review.review_text && (
                        <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                          {review.review_text}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductReviewSection;
