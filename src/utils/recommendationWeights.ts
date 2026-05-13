/**
 * Day-based weight blend for personalised recommendations.
 *
 * Day 0:  onboarding=1.0, behavioral=0.0  (new user — onboarding is all we have)
 * Day 30+: onboarding=0.3, behavioral=0.7 (mature user — behavior dominates,
 *         onboarding stays as a tiebreaker signal)
 * In-between: linear interpolation by days since profile creation.
 */
export interface RecommendationWeights {
  onboardingWeight: number;
  behavioralWeight: number;
}

const RAMP_DAYS = 30;
const FINAL_ONBOARDING_WEIGHT = 0.3;
const FINAL_BEHAVIORAL_WEIGHT = 0.7;

export function getRecommendationWeights(
  profileCreatedAt: string | null | undefined,
  now: Date = new Date(),
): RecommendationWeights {
  if (!profileCreatedAt) {
    return { onboardingWeight: 1, behavioralWeight: 0 };
  }
  const created = new Date(profileCreatedAt).getTime();
  if (!Number.isFinite(created)) {
    return { onboardingWeight: 1, behavioralWeight: 0 };
  }
  const ageMs = now.getTime() - created;
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
  const t = Math.min(1, ageDays / RAMP_DAYS);

  const onboardingWeight = 1 + (FINAL_ONBOARDING_WEIGHT - 1) * t; // 1 → 0.3
  const behavioralWeight = FINAL_BEHAVIORAL_WEIGHT * t;            // 0 → 0.7

  return { onboardingWeight, behavioralWeight };
}
