import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMySupportStatus, useSupportMutations } from '@/hooks/useSupportRequest';
import type { SupportAnswers } from '@/services/support';

/**
 * "Get Support" — the client's intake card (Sprint 2 pivot, 2026-10-03).
 *
 *   ask → intro (AI empathy line + fixed team line) → optional questions → done
 *
 * The request is created at "Get Support", before the questions, because the
 * questions are optional: a parent who leaves after the first step still has a
 * request the team can act on. Answers are saved once, when the last question is
 * submitted or skipped.
 *
 * Answers are stored as canonical English values so the admin queue reads the same
 * in every language; the UI translates them for display via OPTION ids.
 */

type Stage = 'ask' | 'intro' | 'q' | 'done';
type StepKey = 'support_type' | 'insurance' | 'provider' | 'notes';

interface Option { id: string; en: string }

const OPTIONS: Record<Exclude<StepKey, 'notes'>, Option[]> = {
  support_type: [
    { id: 'expert',  en: 'Yes, connect me with an expert' },
    { id: 'content', en: 'Start with videos & guides' },
    { id: 'mix',     en: 'A mix of both' },
  ],
  insurance: [
    { id: 'yes',      en: "Yes, I'd like to use insurance" },
    { id: 'self_pay', en: "No, I'll pay out of pocket" },
    { id: 'unsure',   en: "I'm not sure yet" },
  ],
  provider: [
    { id: 'bcbs',     en: 'Blue Cross Blue Shield' },
    { id: 'aetna',    en: 'Aetna' },
    { id: 'cigna',    en: 'Cigna' },
    { id: 'uhc',      en: 'UnitedHealthcare' },
    { id: 'medicaid', en: 'Medicaid' },
    { id: 'other',    en: 'Other' },
  ],
};

interface Step { key: StepKey; when?: (a: Partial<Record<StepKey, string>>) => boolean }

const STEPS: Step[] = [
  { key: 'support_type' },
  { key: 'insurance', when: (a) => a.support_type !== 'content' },
  { key: 'provider',  when: (a) => a.insurance === 'yes' },
  { key: 'notes' },
];

const SUGGESTIONS = ['milk', 'sleep', 'pelvic', 'overwhelmed'] as const;
const SUGGESTION_EN: Record<(typeof SUGGESTIONS)[number], string> = {
  milk: "I'm struggling with milk production",
  sleep: "My baby isn't sleeping",
  pelvic: 'Pelvic floor recovery',
  overwhelmed: "I'm feeling overwhelmed",
};

const visibleSteps = (a: Partial<Record<StepKey, string>>) => STEPS.filter((s) => !s.when || s.when(a));

const GetSupportCard: React.FC = () => {
  const { t } = useTranslation();
  const { data: status, isLoading } = useMySupportStatus();
  const { create, answers: saveAnswers } = useSupportMutations();

  // null = derive from the server (open request → 'done', none → 'ask').
  const [stage, setStage] = useState<Stage | null>(null);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Partial<Record<StepKey, string>>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [note, setNote] = useState('');
  const [crisis, setCrisis] = useState<string | null>(null);

  const effectiveStage: Stage = stage ?? (status ? 'done' : 'ask');
  const steps = useMemo(() => visibleSteps(picked), [picked]);
  const step = steps[stepIdx];

  // A request restored from the server shows its own urgency.
  useEffect(() => {
    if (stage === null && status?.is_urgent) setUrgent(true);
  }, [stage, status?.is_urgent]);

  const optLabel = (key: Exclude<StepKey, 'notes'>, id: string) =>
    t(`support.options.${key}.${id}`, OPTIONS[key].find((o) => o.id === id)?.en ?? id);

  /** Server answers are canonical English; map back to an id for translated display. */
  const displayAnswer = (key: StepKey, value: string) => {
    if (key === 'notes') return value;
    const id = OPTIONS[key].find((o) => o.en === value)?.id;
    return id ? optLabel(key, id) : value;
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || create.isPending) return;
    try {
      const res = await create.mutateAsync(trimmed);
      setRequestId(res.id);
      setReply(res.reply);
      setUrgent(res.urgent);
      setPicked({});
      setStepIdx(0);
      setNote('');
      setCrisis(null);
      setStage('intro');
    } catch (err) {
      console.error('Get Support: create failed', err);
      toast.error(err instanceof Error ? err.message : t('support.errors.create', 'We could not send your request. Please try again.'));
    }
  };

  const finish = async (finalPicked: Partial<Record<StepKey, string>>) => {
    const id = requestId ?? status?.id;
    if (!id) return;
    const payload: SupportAnswers = {};
    for (const s of visibleSteps(finalPicked)) {
      const v = finalPicked[s.key];
      if (!v) continue;
      payload[s.key] = s.key === 'notes' ? v : OPTIONS[s.key].find((o) => o.id === v)?.en ?? v;
    }
    try {
      const res = await saveAnswers.mutateAsync({ id, answers: payload });
      if (res.crisis) setCrisis(res.crisis);
      if (res.urgent) setUrgent(true);
      setStage('done');
    } catch (err) {
      console.error('Get Support: saving answers failed', err);
      toast.error(err instanceof Error ? err.message : t('support.errors.answers', 'We could not save your answers. Please try again.'));
    }
  };

  const pick = (id: string) => {
    if (!step) return;
    const next = { ...picked, [step.key]: id };
    // Changing an earlier answer can hide later steps; drop answers that no longer apply.
    const allowed = new Set(visibleSteps(next).map((s) => s.key));
    for (const k of Object.keys(next) as StepKey[]) if (!allowed.has(k)) delete next[k];
    setPicked(next);
    const nextSteps = visibleSteps(next);
    const i = nextSteps.findIndex((s) => s.key === step.key) + 1;
    window.setTimeout(() => {
      if (i >= nextSteps.length) finish(next);
      else setStepIdx(i);
    }, 220);
  };

  const submitNote = (value: string) => {
    const next = { ...picked, notes: value.trim() || undefined };
    setPicked(next);
    finish(next);
  };

  const reset = () => {
    setStage('ask');
    setText('');
    setReply(null);
    setUrgent(false);
    setRequestId(null);
    setPicked({});
    setStepIdx(0);
    setNote('');
    setCrisis(null);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-card p-6 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading', 'Loading…')}
      </div>
    );
  }

  const progress =
    effectiveStage === 'done' ? 100 : Math.round(((stepIdx + 1) / (steps.length + 1)) * 100);

  // What the "done" view summarises: this session's picks, or the restored request.
  const summaryText = effectiveStage === 'done' && stage === null ? status?.request_text ?? '' : text.trim();
  const summaryAnswers: Partial<Record<StepKey, string>> =
    stage === null
      ? (status?.answers ?? {})
      : Object.fromEntries(
          visibleSteps(picked)
            .filter((s) => picked[s.key])
            .map((s) => [s.key, s.key === 'notes' ? picked[s.key]! : OPTIONS[s.key].find((o) => o.id === picked[s.key])?.en ?? picked[s.key]!]),
        );

  return (
    <section
      aria-labelledby="get-support-title"
      className="bg-white rounded-xl border border-indigo-100 shadow-card overflow-hidden"
    >
      {(effectiveStage === 'q' || effectiveStage === 'done') && (
        <div className="h-1 bg-indigo-50" aria-hidden>
          <div className="h-1 bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="p-5 sm:p-6 flex flex-col gap-4">
        {effectiveStage === 'ask' && (
          <>
            <div>
              <h2 id="get-support-title" className="text-[22px] font-bold leading-tight text-gray-900">
                {t('support.ask.title', 'What can we help you with?')}
              </h2>
              <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                {t('support.ask.subtitle', 'Tell us in your own words. Our team will find the right support for you.')}
              </p>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t('support.ask.placeholder', "e.g. I'm struggling with milk production")}
              className="w-full resize-none rounded-lg border border-indigo-100 bg-indigo-50/50 px-3.5 py-3 text-[15px] leading-snug text-gray-900 placeholder:text-gray-400 outline-none focus:border-indigo-600"
            />
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setText(t(`support.suggestions.${s}`, SUGGESTION_EN[s]))}
                  className="rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-[13px] font-semibold text-indigo-600 hover:border-indigo-600 transition-colors"
                >
                  {t(`support.suggestions.${s}`, SUGGESTION_EN[s])}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim() || create.isPending}
              className="w-full rounded-lg bg-indigo-600 py-4 px-6 text-base font-bold text-white shadow-sm transition-colors disabled:bg-indigo-600/40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('support.ask.button', 'Get Support')}
            </button>
          </>
        )}

        {effectiveStage === 'intro' && (
          <div className="flex flex-col gap-3.5 animate-in fade-in duration-300">
            <h2 id="get-support-title" className="sr-only">{t('support.ask.title', 'What can we help you with?')}</h2>
            <p className="rounded-lg bg-indigo-50/60 px-3 py-2.5 text-sm text-gray-600 leading-relaxed break-words">
              “{text.trim()}”
            </p>
            {urgent ? (
              <CrisisBox text={reply} />
            ) : (
              <p className="text-[15px] leading-relaxed text-gray-900">{reply}</p>
            )}
            <p className="text-[15px] leading-relaxed text-gray-900 font-semibold">
              {t(
                'support.intro.team',
                "Okay, our team is taking care of this for you and will find you resources. While we have you, answering a few quick questions can help us find solutions that fit you best. They're completely optional.",
              )}
            </p>
            <button
              type="button"
              onClick={() => { setStepIdx(0); setStage('q'); }}
              className="w-full rounded-lg bg-indigo-600 py-4 px-6 text-base font-bold text-white shadow-sm"
            >
              {t('support.intro.button', 'Answer a Few Questions')}
            </button>
            <p className="-mt-1 text-center text-xs text-gray-500">
              {t('support.intro.optional', 'Optional · Takes about 1 minute')}
            </p>
          </div>
        )}

        {effectiveStage === 'q' && step && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => (stepIdx > 0 ? setStepIdx(stepIdx - 1) : setStage('intro'))}
                className="flex items-center gap-1 text-[13px] font-semibold text-indigo-600"
              >
                <ArrowLeft className="w-4 h-4" /> {t('common.back', 'Back')}
              </button>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                {t('support.q.counter', 'Question {{n}} of {{total}}', { n: stepIdx + 1, total: steps.length })}
              </span>
            </div>
            <h3 className="text-xl font-bold leading-snug text-gray-900">
              {t(`support.q.${step.key}`, {
                support_type: 'While we have you, help us figure out what kind of resources would be a good fit. Do you want to go directly to an expert who can help?',
                insurance: 'Are you looking to use insurance?',
                provider: 'Which insurance provider do you have?',
                notes: 'Anything else I should know?',
              }[step.key])}
            </h3>

            {step.key !== 'notes' ? (
              <div className="flex flex-col gap-2" role="radiogroup">
                {OPTIONS[step.key].map((o, i) => {
                  const on = picked[step.key] === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={saveAnswers.isPending}
                      onClick={() => pick(o.id)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-lg border bg-white px-3.5 py-3 text-left text-[15px] font-semibold text-gray-900 transition-colors hover:border-indigo-600',
                        on ? 'border-indigo-600 shadow-sm' : 'border-indigo-100',
                      )}
                    >
                      <span
                        className={cn(
                          'w-6 h-6 flex-shrink-0 rounded-md border border-indigo-100 flex items-center justify-center text-xs font-bold',
                          on ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600',
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1">{optLabel(step.key as Exclude<StepKey, 'notes'>, o.id)}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder={t('support.q.notesPlaceholder', 'Share anything that might help our team')}
                  className="w-full resize-none rounded-lg border border-indigo-100 bg-white px-3.5 py-3 text-[15px] leading-snug text-gray-900 outline-none focus:border-indigo-600"
                />
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => submitNote(note)}
                    disabled={saveAnswers.isPending}
                    className="flex-1 rounded-lg bg-indigo-600 py-3.5 px-5 text-base font-bold text-white shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {saveAnswers.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t('support.q.submit', 'Submit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => submitNote('')}
                    disabled={saveAnswers.isPending}
                    className="px-2 py-2.5 text-[15px] font-bold text-gray-800 underline disabled:opacity-60"
                  >
                    {t('support.q.skip', 'Skip')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {effectiveStage === 'done' && (
          <div className="flex flex-col gap-1 animate-in fade-in duration-300">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h2 id="get-support-title" className="text-xl font-bold text-gray-900">
                {t('support.done.title', 'Your Request')}
              </h2>
              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-green-50 text-green-700 text-xs font-bold">
                <Check className="w-3 h-3" strokeWidth={3} />
                {t('support.done.sent', 'Sent to our team')}
              </span>
            </div>

            {/* Any urgent request keeps its crisis resources on screen, whether it was
                flagged at submit (reply holds the crisis text), by the notes (crisis), or
                restored from the server (empathy_reply is rewritten to the crisis text). */}
            {(crisis || urgent) && (
              <div className="mb-2">
                <CrisisBox text={crisis ?? (stage === null ? status?.empathy_reply ?? null : reply)} />
              </div>
            )}

            <SummaryRow label={t('support.done.lookingFor', 'Looking for help with')} value={summaryText} />
            {visibleSteps(
              Object.fromEntries(
                Object.entries(summaryAnswers).map(([k, v]) => [
                  k,
                  k === 'notes' ? v : OPTIONS[k as Exclude<StepKey, 'notes'>]?.find((o) => o.en === v)?.id ?? v,
                ]),
              ),
            )
              .filter((s) => summaryAnswers[s.key])
              .map((s) => (
                <SummaryRow
                  key={s.key}
                  label={t(`support.done.labels.${s.key}`, { support_type: 'Support type', insurance: 'Insurance', provider: 'Provider', notes: 'Notes' }[s.key])}
                  value={displayAnswer(s.key, summaryAnswers[s.key]!)}
                />
              ))}

            <button
              type="button"
              onClick={reset}
              className="self-start pt-2.5 text-sm font-bold text-gray-800 underline"
            >
              {t('support.done.again', 'Ask About Something Else')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-2.5 border-t border-indigo-50 text-[13px] leading-snug">
    <span className="text-gray-600 flex-shrink-0">{label}</span>
    <span className="font-semibold text-right text-gray-900 break-words min-w-0">{value}</span>
  </div>
);

const CrisisBox: React.FC<{ text: string | null }> = ({ text }) =>
  text ? (
    <div role="alert" className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
      <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <p className="text-sm leading-relaxed text-red-900">{text}</p>
    </div>
  ) : null;

export default GetSupportCard;
