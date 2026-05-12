import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Baby, Heart, Users, ArrowRight, Mail, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TermsOfServiceContent, PrivacyPolicyContent } from '@/components/legal/LegalDocuments';

const SUPPORT_EMAIL = 'support@whisperoo.app';

type JourneyStage = 'pregnant' | 'trying' | 'postpartum';

const JOURNEY_OPTIONS: Array<{
  value: JourneyStage;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'pregnant',   label: "I'm pregnant",   description: 'Expecting in the months ahead', Icon: Baby },
  { value: 'trying',     label: "We're trying",   description: 'Planning or in the process',    Icon: Heart },
  { value: 'postpartum', label: "I'm postpartum", description: 'Baby is here — newborn through 1 year', Icon: Users },
];

const SJMCComingSoon: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tenantSlug = useMemo(
    () => (searchParams.get('tenant') || 'st-joseph-medical-center-moq54rfp').trim(),
    [searchParams]
  );
  const source = searchParams.get('source');
  const department = searchParams.get('dept');
  const qrToken = searchParams.get('qr');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [journeyStage, setJourneyStage] = useState<JourneyStage | null>(null);
  const [expectedDate, setExpectedDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const needsDate = journeyStage === 'pregnant' || journeyStage === 'postpartum';
  const dateLabel = journeyStage === 'pregnant' ? 'Due date' : "Baby's birthdate";
  const dateHelper =
    journeyStage === 'pregnant'
      ? 'So we can tailor what we send you as your due date approaches.'
      : journeyStage === 'postpartum'
      ? 'So we can match resources to where your baby is in their first year.'
      : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      toast({ title: 'Please fill in your name, email and mobile number.', variant: 'destructive' });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast({ title: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }
    if (needsDate && !expectedDate) {
      toast({
        title: journeyStage === 'pregnant'
          ? 'Please enter your due date.'
          : "Please enter your baby's birthdate.",
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('waitlist_signups').insert({
        tenant_slug: tenantSlug,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        journey_stage: journeyStage,
        expected_date: needsDate ? expectedDate : null,
        source,
        department,
        qr_token: qrToken,
        metadata: {
          path: typeof window !== 'undefined' ? window.location.pathname : null,
          referrer: typeof document !== 'undefined' ? document.referrer : null,
        },
      });

      if (error) {
        if (error.code === '23505') {
          // Already on the list — treat as success
          setSubmitted(true);
          return;
        }
        throw error;
      }
      setSubmitted(true);
    } catch (err: any) {
      console.error('Waitlist signup failed:', err);
      toast({
        title: "Something went wrong",
        description: err?.message || 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E2A5C] text-white flex flex-col">
      {/* Header */}
      <header className="px-6 sm:px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-white rounded-md shadow-sm px-3 py-2">
            <svg
              viewBox="0 0 260 90"
              className="h-10 w-auto"
              role="img"
              aria-label="HSA — Healthcare Systems of America"
            >
              {/* Red plus / cross */}
              <g>
                <rect x="4"  y="20" width="46" height="46" rx="4" fill="#E63946" />
                <rect x="20" y="26" width="14" height="34" fill="#FFFFFF" />
                <rect x="11" y="35" width="32" height="14" fill="#FFFFFF" />
              </g>
              {/* "HSA" wordmark — blue fill with red outline */}
              <text
                x="64"
                y="62"
                fontFamily="'Plus Jakarta Sans', Arial, sans-serif"
                fontWeight="900"
                fontSize="58"
                letterSpacing="-1"
                fill="#1F3F8A"
                stroke="#E63946"
                strokeWidth="2.5"
                paintOrder="stroke"
              >
                HSA
              </text>
              {/* Tagline */}
              <text
                x="64"
                y="80"
                fontFamily="'Plus Jakarta Sans', Arial, sans-serif"
                fontWeight="700"
                fontSize="11"
                letterSpacing="0.2"
                fill="#E63946"
              >
                Healthcare Systems of America
              </text>
            </svg>
          </div>
          <div className="hidden sm:block h-8 w-px bg-white/30" />
          <div className="hidden sm:flex items-center gap-2">
            <img src="/stork-avatar.png" alt="" className="h-7 w-7 object-contain" />
            <span className="text-white font-semibold text-lg">Whisperoo</span>
          </div>
        </div>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 transition rounded-full px-4 py-2 text-sm font-medium border border-white/15"
        >
          <Mail className="w-4 h-4" />
          Contact us
        </a>
      </header>

      {/* Main */}
      <main className="flex-1 px-6 sm:px-10 pb-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start pt-6 lg:pt-10">
          {/* Left: hero */}
          <div className="text-white">
            <p className="uppercase tracking-[0.18em] text-xs sm:text-sm font-semibold text-[#F4A93C] mb-5">
              Coming soon to St. Joseph Medical Center
            </p>
            <h1 className="font-extrabold leading-[1.05] text-4xl sm:text-5xl lg:text-[3.5rem]">
              A calmer way through pregnancy, birth, and the months after.
            </h1>
            <p className="mt-6 text-white/75 text-base sm:text-lg max-w-xl leading-relaxed">
              Whisperoo is partnering with St. Joseph Medical Center to bring vetted experts,
              on-demand resources, and gentle check-ins to every parent — free for our maternity patients.
              Join the waitlist and we&apos;ll reach out the day it goes live.
            </p>

            {/* Decorative illustration */}
            <div className="relative mt-10 hidden sm:block h-[320px] max-w-md">
              <div className="absolute left-6 top-4 w-[240px] h-[240px] rounded-full bg-gradient-to-br from-[#F6C9B0] via-[#EFB39A] to-[#1F4A8E]" />
              <div className="absolute left-16 top-10 w-[200px] h-[200px] rounded-full bg-[#0E2A5C]" />
              <div className="absolute left-44 top-14 w-6 h-6 rounded-full bg-[#F4A93C]" />
              <div className="absolute left-8 top-0 bg-[#F4A93C] text-[#0E2A5C] font-semibold text-xs rounded-full px-3 py-1.5 shadow-md">
                24/48h check-in
              </div>
              <div className="absolute left-0 top-40 bg-[#3460B2] text-white font-medium text-xs rounded-full px-3 py-1.5 shadow-md">
                Pelvic floor • 1:1 Call
              </div>
              <div className="absolute left-36 bottom-4 bg-white text-[#0E2A5C] font-medium text-xs rounded-full px-3 py-1.5 shadow-md flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Lactation expert
              </div>
            </div>
          </div>

          {/* Right: card */}
          <div className="bg-white text-gray-900 rounded-2xl shadow-xl p-6 sm:p-8 lg:p-10">
            {submitted ? (
              <div className="text-center py-6">
                <div className="mx-auto w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-[#0E2A5C]">You&apos;re on the list</h2>
                <p className="mt-2 text-gray-600">
                  Thanks{fullName ? `, ${fullName.split(' ')[0]}` : ''}. We&apos;ll text you the day
                  Whisperoo opens at St. Joseph Medical Center.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#3460B2]">
                    Join <span className="text-[#0E2A5C]">the waitlist</span>
                  </p>
                  <h2 className="mt-2 text-2xl sm:text-[28px] font-extrabold text-[#0E2A5C] leading-tight">
                    Be the first to get access
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    We&apos;ll text you the day Whisperoo opens at St. Joseph — free for our maternity patients.
                  </p>
                </div>

                <div>
                  <label htmlFor="full-name" className="block text-sm font-medium text-gray-800 mb-1.5">
                    Your name
                  </label>
                  <input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Neha Patel"
                    autoComplete="name"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3460B2] focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-800 mb-1.5">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    autoComplete="email"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3460B2] focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-800 mb-1.5">
                    Mobile number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(713) 555-0142"
                    autoComplete="tel"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3460B2] focus:border-transparent"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">So we can text you when it&apos;s live.</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-800 mb-2">Where are you in your journey?</p>
                  <div className="space-y-2.5">
                    {JOURNEY_OPTIONS.map(({ value, label, description, Icon }) => {
                      const selected = journeyStage === value;
                      return (
                        <button
                          type="button"
                          key={value}
                          onClick={() => setJourneyStage(value)}
                          className={`w-full text-left flex items-center gap-3 rounded-xl border px-3.5 py-3 transition ${
                            selected
                              ? 'border-[#3460B2] bg-[#EEF3FB] ring-1 ring-[#3460B2]'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <span className="w-9 h-9 rounded-full bg-[#EEF3FB] flex items-center justify-center shrink-0">
                            <Icon className="w-4.5 h-4.5 text-[#0E2A5C]" />
                          </span>
                          <span className="flex-1">
                            <span className="block text-sm font-semibold text-[#0E2A5C]">{label}</span>
                            <span className="block text-xs text-gray-500">{description}</span>
                          </span>
                          <span
                            className={`w-4 h-4 rounded-full border ${
                              selected ? 'border-[#3460B2] bg-[#3460B2] ring-2 ring-[#3460B2]/20' : 'border-gray-300'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {needsDate && (
                  <div>
                    <label htmlFor="expected-date" className="block text-sm font-medium text-gray-800 mb-1.5">
                      {dateLabel}
                    </label>
                    <input
                      id="expected-date"
                      type="date"
                      value={expectedDate}
                      onChange={(e) => setExpectedDate(e.target.value)}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3460B2] focus:border-transparent"
                    />
                    <p className="mt-1.5 text-xs text-gray-500">{dateHelper}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#0E2A5C] hover:bg-[#0a214a] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-3 transition"
                >
                  {submitting ? 'Saving…' : 'Save my spot'}
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>

                <p className="text-xs text-gray-500 text-center leading-relaxed">
                  By joining, you agree to receive marketing emails and recurring text messages from
                  Whisperoo and St. Joseph about our launch, product updates, and parenting resources.
                  Message frequency varies. Msg &amp; data rates may apply. See our{' '}
                  <Dialog>
                    <DialogTrigger className="text-[#3460B2] hover:underline font-medium">
                      Privacy Policy
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Privacy Policy</DialogTitle>
                      </DialogHeader>
                      <DialogDescription className="mt-4 text-left">
                        <PrivacyPolicyContent />
                      </DialogDescription>
                    </DialogContent>
                  </Dialog>
                  {' '}and{' '}
                  <Dialog>
                    <DialogTrigger className="text-[#3460B2] hover:underline font-medium">
                      Terms and Conditions
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Terms and Conditions</DialogTitle>
                      </DialogHeader>
                      <DialogDescription className="mt-4 text-left">
                        <TermsOfServiceContent />
                      </DialogDescription>
                    </DialogContent>
                  </Dialog>.
                </p>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 sm:px-10 py-5 text-xs text-white/60 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div>© 2026 Whisperoo, Inc. · In partnership with St. Joseph Medical Center · Houston, TX</div>
        <div className="flex gap-5">
          <a href="/privacy" className="hover:text-white/90">Privacy</a>
          <a href="/accessibility" className="hover:text-white/90">Accessibility</a>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white/90">Contact</a>
        </div>
      </footer>
    </div>
  );
};

export default SJMCComingSoon;
