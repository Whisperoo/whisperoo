import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { calculateStage, CATEGORY_META, StageInfo } from '@/utils/stageCalculator';
import { ChevronDown, ChevronUp, Check, Phone, Baby, Clock } from 'lucide-react';

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
  title_es?: string | null;
  title_vi?: string | null;
  description: string | null;
  description_es?: string | null;
  description_vi?: string | null;
  category: string;
  sort_order: number;
  is_universal: boolean;
  tenant_id: string | null;
  hospital_phone: string | null;
}

interface ProgressRecord {
  id: string;
  template_id: string;
  completed: boolean;
  completed_at: string | null;
}

interface KidChecklist {
  kid: Kid;
  stage: StageInfo;
  templates: ChecklistTemplate[];
  progress: Map<string, ProgressRecord>;
}

const CareChecklist: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const { user } = useAuth();
  const { isHospitalUser, tenant } = useTenant();
  const [kidChecklists, setKidChecklists] = useState<KidChecklist[]>([]);
  const [expandedKids, setExpandedKids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [togglingItems, setTogglingItems] = useState<Set<string>>(new Set());

  const fetchChecklists = useCallback(async () => {
    if (!user) return;

    try {
      // 1. Fetch user's kids
      const { data: kids, error: kidsError } = await supabase
        .from('kids')
        .select('id, first_name, expected_name, is_expecting, birth_date, due_date')
        .eq('parent_id', user.id);

      if (kidsError) throw kidsError;
      if (!kids || kids.length === 0) {
        setKidChecklists([]);
        setLoading(false);
        return;
      }

      // 2. Calculate stages
      const kidsWithStages = kids
        .map(kid => ({ kid: kid as Kid, stage: calculateStage(kid) }))
        .filter((entry): entry is { kid: Kid; stage: StageInfo } => entry.stage !== null);

      if (kidsWithStages.length === 0) {
        setKidChecklists([]);
        setLoading(false);
        return;
      }

      // 3. Fetch templates for all relevant stages
      const stageKeys = [...new Set(kidsWithStages.map(k => k.stage.stageKey))];
      
      const templateQuery = supabase
        .from('care_checklist_templates')
        .select('*')
        .in('stage', stageKeys)
        .order('sort_order', { ascending: true });

      const { data: templates, error: templatesError } = await templateQuery;
      if (templatesError) throw templatesError;

      // Filter templates: universal + matching tenant
      const filteredTemplates = (templates || []).filter(t => 
        t.is_universal || (isHospitalUser && tenant && t.tenant_id === tenant.id)
      );

      // 4. Fetch user's progress
      const kidIds = kidsWithStages.map(k => k.kid.id);
      const { data: progressData, error: progressError } = await supabase
        .from('care_checklist_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('kid_id', kidIds);

      if (progressError) throw progressError;

      // 5. Build checklist data per kid
      const checklists: KidChecklist[] = kidsWithStages.map(({ kid, stage }) => {
        const stageTemplates = filteredTemplates.filter(t => t.stage === stage.stageKey);
        const kidProgress = (progressData || []).filter(p => p.kid_id === kid.id);
        const progressMap = new Map(kidProgress.map(p => [p.template_id, p]));

        return { kid, stage, templates: stageTemplates, progress: progressMap };
      });

      setKidChecklists(checklists);

      // Keep checklist collapsed by default (do not auto-expand)
    } catch (err) {
      console.error('Error fetching care checklists:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isHospitalUser, tenant]);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  const toggleExpand = (kidId: string) => {
    setExpandedKids(prev => {
      const next = new Set(prev);
      if (next.has(kidId)) next.delete(kidId);
      else next.add(kidId);
      return next;
    });
  };

  const toggleItem = async (kidId: string, templateId: string, currentlyCompleted: boolean) => {
    if (!user) return;
    const itemKey = `${kidId}-${templateId}`;
    if (togglingItems.has(itemKey)) return;

    setTogglingItems(prev => new Set(prev).add(itemKey));

    try {
      if (currentlyCompleted) {
        // Uncheck — delete progress record
        await supabase
          .from('care_checklist_progress')
          .delete()
          .eq('user_id', user.id)
          .eq('kid_id', kidId)
          .eq('template_id', templateId);
      } else {
        // Check — upsert progress record
        await supabase
          .from('care_checklist_progress')
          .upsert({
            user_id: user.id,
            kid_id: kidId,
            template_id: templateId,
            completed: true,
            completed_at: new Date().toISOString()
          }, { onConflict: 'user_id,kid_id,template_id' });
      }

      // Optimistic update
      setKidChecklists(prev => prev.map(kc => {
        if (kc.kid.id !== kidId) return kc;
        const newProgress = new Map(kc.progress);
        if (currentlyCompleted) {
          newProgress.delete(templateId);
        } else {
          newProgress.set(templateId, {
            id: 'temp',
            template_id: templateId,
            completed: true,
            completed_at: new Date().toISOString()
          });
        }
        return { ...kc, progress: newProgress };
      }));
    } catch (err) {
      console.error('Error toggling checklist item:', err);
    } finally {
      setTogglingItems(prev => {
        const next = new Set(prev);
        next.delete(itemKey);
        return next;
      });
    }
  };

  // Don't render if no checklists
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-card p-6 border border-gray-200 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gray-200 rounded-lg" />
          <div className="h-5 bg-gray-200 rounded w-40" />
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-5/6" />
        </div>
      </div>
    );
  }

  if (kidChecklists.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center shadow-sm">
          <Check className="w-4 h-4 text-white" />
        </div>
        <h2 className="text-lg font-bold text-brand-dark">{t('careChecklist.header', { defaultValue: 'Care Checklist' })}</h2>
      </div>

      {kidChecklists.map(({ kid, stage, templates, progress }) => {
        const isExpanded = expandedKids.has(kid.id);
        const completedCount = templates.filter(t => progress.get(t.id)?.completed).length;
        const totalCount = templates.length;
        const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
        const kidName = kid.is_expecting
          ? kid.expected_name || t('childrenManager.expectedBaby', { defaultValue: 'Expected Baby' })
          : kid.first_name || t('childrenManager.child', { defaultValue: 'Child' });

        return (
          <div
            key={kid.id}
            className="bg-white rounded-xl shadow-card border border-gray-200 overflow-hidden transition-all duration-300"
          >
            {/* Card Header — Always visible */}
            <button
              onClick={() => toggleExpand(kid.id)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-brand-light rounded-full flex items-center justify-center flex-shrink-0">
                  {kid.is_expecting ? (
                    <Clock className="w-5 h-5 text-brand-primary" />
                  ) : (
                    <Baby className="w-5 h-5 text-brand-primary" />
                  )}
                </div>
                <div className="text-left min-w-0">
                  <h3 className="text-sm font-bold text-brand-dark truncate">
                    {kidName}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    {t(`stages.${stage.stageKey}`, { defaultValue: stage.stageLabel })} · {stage.ageDescriptionKey
                      ? t(stage.ageDescriptionKey, { ...stage.ageDescriptionParams, defaultValue: stage.ageDescription })
                      : stage.ageDescription}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-auto sm:ml-3">
                {/* Progress indicator */}
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${progressPercent}%`,
                        background: progressPercent === 100
                          ? '#22c55e'
                          : 'linear-gradient(90deg, #4A6FA5, #6B8BC7)'
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-500">
                    {completedCount}/{totalCount}
                  </span>
                </div>
                {/* Mobile version: just the count */}
                <div className="sm:hidden flex items-center bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                  <span className="text-[10px] font-bold text-brand-primary">
                    {completedCount}/{totalCount}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
              </div>
            </button>

            {/* Expandable checklist items */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-3 sm:px-5 py-3 space-y-1">
                {templates.map((template) => {
                  const isCompleted = progress.get(template.id)?.completed || false;
                  const isToggling = togglingItems.has(`${kid.id}-${template.id}`);
                  const categoryMeta = CATEGORY_META[template.category] || CATEGORY_META.general;

                  return (
                    <div
                      key={template.id}
                      className={`group flex items-start gap-2.5 py-3 px-2 sm:px-3 rounded-lg transition-all duration-200 cursor-pointer ${
                        isCompleted
                          ? 'bg-gray-50/50'
                          : 'hover:bg-brand-light/30'
                      }`}
                      onClick={() => toggleItem(kid.id, template.id, isCompleted)}
                    >
                      {/* Checkbox */}
                      <div className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${
                        isToggling
                          ? 'border-gray-300 bg-gray-100 animate-pulse'
                          : isCompleted
                            ? 'border-brand-primary bg-brand-primary'
                            : 'border-gray-300 group-hover:border-brand-primary'
                      }`}>
                        {isCompleted && !isToggling && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs" aria-hidden="true">{categoryMeta.icon}</span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider`}
                              style={{ color: categoryMeta.color }}
                            >
                              {t(`careChecklist.categories.${template.category}`, { defaultValue: categoryMeta.label })}
                            </span>
                          </div>
                          <span
                            className={`text-sm font-medium transition-all duration-200 break-words leading-snug ${
                              isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'
                            }`}
                          >
                            {currentLang === 'es' && template.title_es
                              ? template.title_es
                              : currentLang === 'vi' && template.title_vi
                              ? template.title_vi
                              : template.title}
                          </span>
                        </div>

                        {(template.description || template.description_es || template.description_vi) && !isCompleted && (
                          <p className="text-xs text-gray-500 leading-relaxed mt-1 break-words">
                            {currentLang === 'es' && template.description_es
                              ? template.description_es
                              : currentLang === 'vi' && template.description_vi
                              ? template.description_vi
                              : template.description}
                          </p>
                        )}

                        {/* Hospital phone on medical items */}
                        {template.hospital_phone && template.category === 'medical' && !isCompleted && (
                          <a
                            href={`tel:${template.hospital_phone.replace(/[^0-9]/g, '')}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-brand-primary hover:text-brand-dark transition-colors bg-brand-light/20 px-2 py-1 rounded-md"
                          >
                            <Phone className="w-3 h-3" />
                            <span className="truncate">{t('careChecklist.schedule', { defaultValue: 'Schedule' })}: {template.hospital_phone}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Completion celebration */}
                {completedCount === totalCount && totalCount > 0 && (
                  <div className="flex items-center gap-2 py-3 px-3 bg-green-50 rounded-lg mt-2">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-green-700">
                      {t('careChecklist.allDone', { name: kidName, defaultValue: `All done! Great job staying on top of ${kidName}'s care. 🎉` })}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CareChecklist;
