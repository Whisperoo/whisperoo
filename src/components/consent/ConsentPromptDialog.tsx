import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { CONSENT_STEP_ENABLED } from '@/config/features';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConsentChoices, useConsentForm } from './ConsentChoices';

/**
 * One-time email/SMS opt-in for parents who signed up before the onboarding
 * consent step existed (client, 2026-10-31: "prompt them once, next login").
 *
 * Shown to onboarded parents whose profile.consent_prompted_at is NULL. Save and
 * "Not now" both mark them as asked — closing the dialog counts as "Not now" — so
 * it never comes back. Experts and admins are never prompted.
 */
const ConsentPromptDialog: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const eligible =
    CONSENT_STEP_ENABLED &&
    !!profile &&
    profile.account_type === 'user' &&
    profile.onboarded === true &&
    !profile.consent_prompted_at;

  // Mount the form (and its consent-copy query) only for eligible parents.
  return eligible ? <PromptBody onDone={refreshProfile} /> : null;
};

const PromptBody: React.FC<{ onDone: () => Promise<void> }> = ({ onDone }) => {
  const { t } = useTranslation();
  const form = useConsentForm();
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  const finish = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setOpen(false);
      setBusy(false);
      // Pull the updated consent_prompted_at so the prompt unmounts for good.
      onDone().catch((e) => console.error('Refreshing profile after consent prompt failed', e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) finish(form.dismiss); }}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>{t('consentPrompt.title', 'Want updates from Whisperoo?')}</DialogTitle>
          <DialogDescription>
            {t('consentPrompt.description', "Choose how you'd like to hear from us. Both are optional.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ConsentChoices form={form} />
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
          <Button variant="ghost" onClick={() => finish(form.dismiss)} disabled={busy}>
            {t('consentPrompt.notNow', 'Not now')}
          </Button>
          <Button onClick={() => finish(form.save)} disabled={busy || form.loading}>
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {t('consentPrompt.save', 'Save my choices')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConsentPromptDialog;
