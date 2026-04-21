import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Calendar, Check, Clock, Stethoscope } from 'lucide-react';
import { CATEGORY_META } from '@/utils/stageCalculator';

interface Kid {
  id: string;
  first_name: string;
  expected_name?: string;
  is_expecting?: boolean;
  birth_date?: string | null;
  due_date?: string | null;
}

interface ChecklistTemplate {
  id: string;
  stage: string;
  stage_label: string;
  title: string;
  description: string | null;
  category: string;
  sort_order: number;
}

interface ProgressRecord {
  id: string;
  template_id: string;
  completed: boolean;
  completed_at: string | null;
}

interface Reminder {
  kid: Kid;
  template: ChecklistTemplate;
  isCompleted: boolean;
  daysRemaining?: number; // Optional, to show urgency
}

const APPOINTMENT_STAGES = [
  'reminder_prenatal_t1',
  'reminder_birth_plan',
  'reminder_48hr_postdischarge',
  'reminder_3wk_postpartum'
];

export const AppointmentReminders: React.FC = () => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingItems, setTogglingItems] = useState<Set<string>>(new Set());

  const fetchReminders = useCallback(async () => {
    if (!user) return;

    try {
      // 1. Fetch user's kids
      const { data: kids, error: kidsError } = await supabase
        .from('kids')
        .select('id, first_name, expected_name, is_expecting, birth_date, due_date')
        .eq('parent_id', user.id);

      if (kidsError) throw kidsError;
      if (!kids || kids.length === 0) {
        setReminders([]);
        setLoading(false);
        return;
      }

      // 2. Determine which reminder stages each kid qualifies for
      const now = new Date();
      const qualifiedStages: { kid: Kid; stageKey: string; daysRemaining?: number }[] = [];

      kids.forEach(kid => {
        if (kid.is_expecting && kid.due_date) {
          const due = new Date(kid.due_date);
          const diffMs = due.getTime() - now.getTime();
          const weeksUntilDue = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
          const gestationalWeeks = Math.max(0, 40 - weeksUntilDue);

          // Rule 1: First Trimester Prenatal (1-13 weeks)
          if (gestationalWeeks >= 1 && gestationalWeeks <= 13) {
            qualifiedStages.push({ kid, stageKey: 'reminder_prenatal_t1', daysRemaining: (14 - gestationalWeeks) * 7 });
          }
          // Rule 2: Birth Plan Check-in (20-32 weeks)
          if (gestationalWeeks >= 20 && gestationalWeeks <= 32) {
            qualifiedStages.push({ kid, stageKey: 'reminder_birth_plan', daysRemaining: (33 - gestationalWeeks) * 7 });
          }
        } else if (!kid.is_expecting && kid.birth_date) {
          const birth = new Date(kid.birth_date);
          const diffMs = now.getTime() - birth.getTime();
          const ageInDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

          // Rule 3: 48hr Post-Discharge (<= 2 days)
          if (ageInDays >= 0 && ageInDays <= 2) {
            qualifiedStages.push({ kid, stageKey: 'reminder_48hr_postdischarge', daysRemaining: 2 - ageInDays });
          }
          // Rule 4: 3-Week Postpartum (<= 21 days)
          if (ageInDays >= 0 && ageInDays <= 21) {
            qualifiedStages.push({ kid, stageKey: 'reminder_3wk_postpartum', daysRemaining: 21 - ageInDays });
          }
        }
      });

      if (qualifiedStages.length === 0) {
        setReminders([]);
        setLoading(false);
        return;
      }

      const activeStageKeys = [...new Set(qualifiedStages.map(q => q.stageKey))];

      // 3. Fetch specific templates for those stages
      const { data: templates, error: templatesError } = await supabase
        .from('care_checklist_templates')
        .select('*')
        .in('stage', activeStageKeys);

      if (templatesError) throw templatesError;
      if (!templates || templates.length === 0) {
        setReminders([]);
        setLoading(false);
        return;
      }

      // 4. Fetch user's progress for these items
      const kidIds = [...new Set(qualifiedStages.map(q => q.kid.id))];
      const templateIds = templates.map(t => t.id);

      const { data: progressData, error: progressError } = await supabase
        .from('care_checklist_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('kid_id', kidIds)
        .in('template_id', templateIds);

      if (progressError) throw progressError;

      // 5. Build the final array of actionable reminders
      const assembledReminders: Reminder[] = [];

      qualifiedStages.forEach(qs => {
        const matchingTemplate = templates.find(t => t.stage === qs.stageKey);
        if (matchingTemplate) {
          const isCompleted = progressData?.some(
            p => p.kid_id === qs.kid.id && p.template_id === matchingTemplate.id && p.completed
          ) || false;

          assembledReminders.push({
            kid: qs.kid,
            template: matchingTemplate,
            isCompleted,
            daysRemaining: qs.daysRemaining
          });
        }
      });

      setReminders(assembledReminders);
    } catch (err) {
      console.error('Error fetching appointment reminders:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const toggleReminder = async (reminder: Reminder) => {
    if (!user) return;
    const itemKey = `${reminder.kid.id}-${reminder.template.id}`;
    if (togglingItems.has(itemKey)) return;

    setTogglingItems(prev => new Set(prev).add(itemKey));

    try {
      if (reminder.isCompleted) {
        await supabase
          .from('care_checklist_progress')
          .delete()
          .eq('user_id', user.id)
          .eq('kid_id', reminder.kid.id)
          .eq('template_id', reminder.template.id);
      } else {
        await supabase
          .from('care_checklist_progress')
          .upsert({
            user_id: user.id,
            kid_id: reminder.kid.id,
            template_id: reminder.template.id,
            completed: true,
            completed_at: new Date().toISOString()
          }, { onConflict: 'user_id,kid_id,template_id' });
      }

      // Optimistic update
      setReminders(prev => prev.map(r => {
        if (r.kid.id === reminder.kid.id && r.template.id === reminder.template.id) {
          return { ...r, isCompleted: !r.isCompleted };
        }
        return r;
      }));
    } catch (err) {
      console.error('Error toggling reminder item:', err);
    } finally {
      setTogglingItems(prev => {
        const next = new Set(prev);
        next.delete(itemKey);
        return next;
      });
    }
  };

  if (loading) return null;
  if (reminders.length === 0) return null;

  // Let's hide completed reminders or push them to bottom
  const sortedReminders = [...reminders].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    return (a.daysRemaining || 999) - (b.daysRemaining || 999);
  });

  return (
    <div className="bg-white rounded-xl shadow-card border border-rose-100 overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-rose-50 flex items-center gap-3 bg-rose-50/30">
        <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Stethoscope className="w-5 h-5 text-rose-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">Important Appointments</h2>
          <p className="text-sm text-gray-500">Time-sensitive reminders for your family</p>
        </div>
      </div>

      <div className="p-2 space-y-1">
        {sortedReminders.map((reminder) => {
          const { kid, template, isCompleted } = reminder;
          const isToggling = togglingItems.has(`${kid.id}-${template.id}`);
          const categoryMeta = CATEGORY_META[template.category] || CATEGORY_META.medical;
          const isUrgent = !isCompleted && reminder.daysRemaining !== undefined && reminder.daysRemaining <= 7;

          return (
            <div
              key={`${kid.id}-${template.id}`}
              className={`group flex items-start gap-3 py-3 px-3 rounded-lg transition-all duration-200 cursor-pointer ${
                isCompleted
                  ? 'bg-gray-50/50 opacity-60 hover:opacity-100'
                  : isUrgent 
                    ? 'bg-rose-50/40 hover:bg-rose-50/80 border border-rose-100/50'
                    : 'hover:bg-gray-50'
              }`}
              onClick={() => toggleReminder(reminder)}
            >
              <div className={`flex-shrink-0 w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                isToggling
                  ? 'border-gray-300 bg-gray-100 animate-pulse'
                  : isCompleted
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-300 group-hover:border-rose-400'
              }`}>
                {isCompleted && !isToggling && (
                  <Check className="w-3.5 h-3.5 text-white" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-sm font-bold transition-all duration-200 ${
                      isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
                    }`}
                  >
                    {template.title}
                  </span>
                  {!isCompleted && isUrgent && (
                    <span className="flex-shrink-0 flex items-center text-[10px] uppercase tracking-wider font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3 mr-1" />
                      Action Needed
                    </span>
                  )}
                </div>

                {!isCompleted && template.description && (
                  <p className="text-xs text-gray-600 leading-relaxed mt-1 pr-2 mb-2">
                    {template.description}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">
                    For: {kid.expected_name || kid.first_name || 'Baby'}
                  </span>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">
                    {template.stage_label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AppointmentReminders;
