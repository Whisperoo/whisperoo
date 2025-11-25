import { supabase } from '@/lib/supabase'
import { calculateAgeInYears } from '@/utils/age'

// Kids data types
export interface KidData {
  name: string
  birthdate: string
}

// Kids validation utilities
export const isValidKid = (kid: KidData): boolean => {
  const hasName = kid.name.trim() !== '';
  const hasBirthdate = kid.birthdate.trim() !== '';
  const isValidDate = hasBirthdate && !isNaN(Date.parse(kid.birthdate));
  return hasName && isValidDate;
}

export const getValidKids = (kidsData: KidData[]): KidData[] => {
  return kidsData.filter(isValidKid);
}

// Kids management utilities with duplicate prevention
let saveInProgress = false;

export const saveKidsData = async (kidsData: { name: string; birthdate: string }[]) => {
  // Prevent multiple simultaneous saves
  if (saveInProgress) {
    console.log('Save already in progress, skipping duplicate save');
    return { success: true, error: null };
  }

  try {
    saveInProgress = true;
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
      throw new Error('No authenticated user')
    }

    // Use a transaction-like approach: get existing, compare, then update only if needed
    const { data: existingKids, error: fetchError } = await supabase
      .from('kids')
      .select('id, first_name, birth_date')
      .eq('parent_id', user.user.id)
      .neq('is_expecting', true);

    if (fetchError) {
      console.error('Error fetching existing kids:', fetchError);
      return { success: false, error: fetchError };
    }

    // Check if data has actually changed to avoid unnecessary operations
    const existingKidsNormalized = (existingKids || []).map(kid => ({
      name: kid.first_name,
      birthdate: kid.birth_date
    })).sort((a, b) => a.name.localeCompare(b.name));

    const newKidsNormalized = kidsData.map(kid => ({
      name: kid.name.trim(),
      birthdate: kid.birthdate.trim()
    })).sort((a, b) => a.name.localeCompare(b.name));

    // Compare to see if data has changed
    const dataHasChanged = JSON.stringify(existingKidsNormalized) !== JSON.stringify(newKidsNormalized);
    
    if (!dataHasChanged) {
      console.log('Kids data unchanged, skipping save');
      return { success: true, error: null };
    }

    // Only proceed with save if data has actually changed
    // First, delete existing kids data (but not expecting babies)
    const { error: deleteError } = await supabase
      .from('kids')
      .delete()
      .eq('parent_id', user.user.id)
      .neq('is_expecting', true);

    if (deleteError) {
      console.error('Error deleting existing kids:', deleteError);
      return { success: false, error: deleteError };
    }

    // Then insert new kids data
    const kidsToInsert = kidsData.map(kid => ({
      parent_id: user.user.id,
      first_name: kid.name.trim(),
      birth_date: kid.birthdate.trim(),
      age: calculateAgeInYears(kid.birthdate.trim()),
      is_expecting: false
    }));

    const { error: insertError } = await supabase
      .from('kids')
      .insert(kidsToInsert);

    if (insertError) {
      console.error('Error saving kids:', insertError);
      return { success: false, error: insertError };
    }
    return { success: true, error: null };
  } catch (error) {
    console.error('Error saving kids data:', error);
    return { success: false, error };
  } finally {
    saveInProgress = false;
  }
}

// Expecting baby utilities
export const saveExpectingBaby = async (dueDate: string, expectedName?: string) => {
  try {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
      throw new Error('No authenticated user')
    }

    // First, remove any existing expecting baby records
    await supabase
      .from('kids')
      .delete()
      .eq('parent_id', user.user.id)
      .eq('is_expecting', true)

    // Create expecting baby record in kids table
    const { error } = await supabase
      .from('kids')
      .insert({
        parent_id: user.user.id,
        is_expecting: true,
        due_date: dueDate,
        expected_name: expectedName || 'Expected Baby',
        first_name: expectedName || 'Expected Baby',
        age: null
      })

    if (error) {
      console.error('Error saving expecting baby:', error)
      return { success: false, error }
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('Error saving expecting baby:', error)
    return { success: false, error }
  }
}

// Date validation utilities
export const validateDueDate = (date: Date): { isValid: boolean; error?: string } => {
  const today = new Date()
  const minDate = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000)) // At least 1 week from now
  const maxDate = new Date(today.getTime() + (45 * 7 * 24 * 60 * 60 * 1000)) // Max 45 weeks from now

  if (date < minDate) {
    return { isValid: false, error: 'Due date must be at least one week from today' }
  }

  if (date > maxDate) {
    return { isValid: false, error: 'Due date cannot be more than 45 weeks from today' }
  }

  return { isValid: true }
}

export const formatDueDate = (date: Date | string): string => {
  // If date is a string (from database), parse it without timezone conversion
  let dateObj: Date;
  if (typeof date === 'string') {
    // Parse YYYY-MM-DD format without timezone conversion
    const [year, month, day] = date.split('-').map(Number);
    dateObj = new Date(year, month - 1, day);
  } else {
    dateObj = date;
  }

  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
