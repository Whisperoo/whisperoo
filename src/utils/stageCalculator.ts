/**
 * Stage Calculator — SOW 4.1
 * Calculates a child's developmental stage from birth_date or due_date.
 * Pure utility function — no API calls, no side effects.
 */

export interface StageInfo {
  stageKey: string;
  stageLabel: string;
  ageDescription: string;
  /** i18n key for translating ageDescription */
  ageDescriptionKey?: string;
  /** Interpolation params for the i18n key */
  ageDescriptionParams?: Record<string, string | number>;
}

interface KidData {
  is_expecting?: boolean;
  birth_date?: string | null;
  due_date?: string | null;
}

/**
 * Calculate developmental stage from a kid's birth or due date.
 * Returns null if no date data is available.
 */
export function calculateStage(kid: KidData): StageInfo | null {
  const now = new Date();

  // --- Expecting path ---
  if (kid.is_expecting && kid.due_date) {
    const due = new Date(kid.due_date);
    const diffMs = due.getTime() - now.getTime();
    const weeksUntilDue = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
    
    // Approximate gestational weeks (40 weeks total)
    const gestationalWeeks = Math.max(0, 40 - weeksUntilDue);

    if (weeksUntilDue < 0) {
      // Past due date — treat as newborn
      return {
        stageKey: 'newborn_0_3m',
        stageLabel: 'Newborn (0-3 months)',
        ageDescription: 'Recently arrived!',
        ageDescriptionKey: 'careChecklist.ageDescription.recentlyArrived'
      };
    }

    const pregnantDesc = `${gestationalWeeks} weeks pregnant · Due in ${weeksUntilDue} weeks`;
    const pregnantParams = { gestational: gestationalWeeks, remaining: weeksUntilDue };

    if (gestationalWeeks < 14) {
      return {
        stageKey: 'expecting_t1',
        stageLabel: 'First Trimester',
        ageDescription: pregnantDesc,
        ageDescriptionKey: 'careChecklist.ageDescription.weeksPregnant',
        ageDescriptionParams: pregnantParams
      };
    } else if (gestationalWeeks < 28) {
      return {
        stageKey: 'expecting_t2',
        stageLabel: 'Second Trimester',
        ageDescription: pregnantDesc,
        ageDescriptionKey: 'careChecklist.ageDescription.weeksPregnant',
        ageDescriptionParams: pregnantParams
      };
    } else {
      return {
        stageKey: 'expecting_t3',
        stageLabel: 'Third Trimester',
        ageDescription: pregnantDesc,
        ageDescriptionKey: 'careChecklist.ageDescription.weeksPregnant',
        ageDescriptionParams: pregnantParams
      };
    }
  }

  // --- Born child path ---
  if (!kid.is_expecting && kid.birth_date) {
    const birth = new Date(kid.birth_date);
    const diffMs = now.getTime() - birth.getTime();
    const ageInDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const ageInMonths = Math.floor(ageInDays / 30.44); // avg days/month
    const ageInWeeks = Math.floor(ageInDays / 7);

    if (ageInMonths < 0) {
      return null; // future birth date — shouldn't happen
    }

    let ageDesc: string;
    let ageKey: string;
    let ageParams: Record<string, string | number>;

    if (ageInMonths < 1) {
      ageDesc = `${ageInWeeks} week${ageInWeeks !== 1 ? 's' : ''} old`;
      ageKey = ageInWeeks === 1 ? 'careChecklist.ageDescription.weeksOld' : 'careChecklist.ageDescription.weeksOld_plural';
      ageParams = { count: ageInWeeks };
    } else if (ageInMonths < 12) {
      ageDesc = `${ageInMonths} month${ageInMonths !== 1 ? 's' : ''} old`;
      ageKey = ageInMonths === 1 ? 'careChecklist.ageDescription.monthsOld' : 'careChecklist.ageDescription.monthsOld_plural';
      ageParams = { count: ageInMonths };
    } else {
      const years = Math.floor(ageInMonths / 12);
      const months = ageInMonths % 12;
      ageDesc = `${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''} old`;
      ageKey = years === 1 ? 'careChecklist.ageDescription.yearsMonthsOld' : 'careChecklist.ageDescription.yearsMonthsOld_plural';
      ageParams = { years, months };
    }

    if (ageInMonths < 3) {
      return { stageKey: 'newborn_0_3m', stageLabel: 'Newborn (0-3 months)', ageDescription: ageDesc, ageDescriptionKey: ageKey, ageDescriptionParams: ageParams };
    } else if (ageInMonths < 6) {
      return { stageKey: 'infant_3_6m', stageLabel: 'Infant (3-6 months)', ageDescription: ageDesc, ageDescriptionKey: ageKey, ageDescriptionParams: ageParams };
    } else if (ageInMonths < 12) {
      return { stageKey: 'infant_6_12m', stageLabel: 'Infant (6-12 months)', ageDescription: ageDesc, ageDescriptionKey: ageKey, ageDescriptionParams: ageParams };
    } else if (ageInMonths < 24) {
      return { stageKey: 'toddler_12_24m', stageLabel: 'Toddler (1-2 years)', ageDescription: ageDesc, ageDescriptionKey: ageKey, ageDescriptionParams: ageParams };
    } else {
      // Older than 24 months — no checklist defined
      return null;
    }
  }

  return null;
}


/** Category metadata for display */
export const CATEGORY_META: Record<string, { icon: string; label: string; color: string }> = {
  medical:   { icon: '🏥', label: 'Medical',    color: '#4A6FA5' },
  milestone: { icon: '🎯', label: 'Milestone',  color: '#6B8BC7' },
  safety:    { icon: '🛡️', label: 'Safety',     color: '#2C4870' },
  nutrition: { icon: '🍼', label: 'Nutrition',  color: '#4A6FA5' },
  general:   { icon: '📋', label: 'General',    color: '#718096' },
};
