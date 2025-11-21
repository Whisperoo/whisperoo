// Age calculation utilities

/**
 * Calculate age from birth date and return formatted string
 * @param birthDate - Date object or ISO string
 * @returns Formatted age string like "2 years", "8 months", "3 weeks"
 */
export const calculateAge = (birthDate: Date | string): string => {
  const birth = new Date(birthDate);
  const today = new Date();
  
  // Validate birth date
  if (isNaN(birth.getTime()) || birth > today) {
    return 'Invalid date';
  }
  
  // Calculate total days difference
  const diffTime = today.getTime() - birth.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Calculate years, months, and remaining days
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  let days = today.getDate() - birth.getDate();
  
  // Adjust for negative days
  if (days < 0) {
    months--;
    const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += lastMonth.getDate();
  }
  
  // Adjust for negative months
  if (months < 0) {
    years--;
    months += 12;
  }
  
  // Return appropriate format based on age
  if (years >= 2) {
    return `${years} years`;
  } else if (years === 1) {
    if (months === 0) {
      return '1 year';
    } else {
      return `1 year, ${months} month${months > 1 ? 's' : ''}`;
    }
  } else if (months >= 1) {
    return `${months} month${months > 1 ? 's' : ''}`;
  } else if (diffDays >= 7) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''}`;
  } else if (diffDays >= 1) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else {
    return 'Less than 1 day';
  }
};

/**
 * Calculate simple age in years (for display purposes)
 * @param birthDate - Date object or ISO string
 * @returns Number of years as integer
 */
export const calculateAgeInYears = (birthDate: Date | string): number => {
  const birth = new Date(birthDate);
  const today = new Date();
  
  if (isNaN(birth.getTime()) || birth > today) {
    return 0;
  }
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return Math.max(0, age);
};

/**
 * Validate if a birth date is reasonable for a child
 * @param birthDate - Date object or ISO string
 * @returns Object with validation result and error message
 */
export const validateBirthDate = (birthDate: Date | string): { isValid: boolean; error?: string } => {
  const birth = new Date(birthDate);
  const today = new Date();
  
  if (isNaN(birth.getTime())) {
    return { isValid: false, error: 'Invalid date format' };
  }
  
  if (birth > today) {
    return { isValid: false, error: 'Birth date cannot be in the future' };
  }
  
  // Check if age is reasonable (not more than 18 years old)
  const ageInYears = calculateAgeInYears(birth);
  if (ageInYears > 18) {
    return { isValid: false, error: 'Child cannot be older than 18 years' };
  }
  
  return { isValid: true };
};