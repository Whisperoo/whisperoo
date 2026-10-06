import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { useMySupportStatus } from '@/hooks/useSupportRequest';
import type { SupportExpert, SupportProduct } from '@/services/support';

/**
 * Shown under the Get Support card while a request is open (new / in progress).
 * Disappears when the team marks the request done in the admin portal.
 *
 * Copy is the client's (2026-10-07). The team sources help off-platform, so the
 * experts/resources below are suggestions ranked by the request's topic — something
 * useful to look at while they wait — not a match.
 */

const initials = (name: string) =>
  name.replace(/^Dr\.?\s*/i, '').split(/[\s,]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const kindLabel = (p: SupportProduct, t: (k: string, d: string) => string) => {
  if (p.product_type === 'consultation') return t('support.status.kind.consultation', '1:1 Call');
  if (p.product_type === 'video') return p.content_type === 'bundle'
    ? t('support.status.kind.videoSeries', 'Video Series')
    : t('support.status.kind.video', 'Video');
  if (p.product_type === 'document') return t('support.status.kind.pdf', 'PDF');
  if (p.product_type === 'course') return t('support.status.kind.course', 'Course');
  if (p.product_type === 'audio') return t('support.status.kind.audio', 'Audio');
  return t('support.status.kind.resource', 'Resource');
};

const SupportStatusCard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: status } = useMySupportStatus();

  if (!status) return null;

  return (
    <section className="rounded-xl border border-indigo-100 bg-indigo-50/60 shadow-card py-4 sm:py-5 animate-in fade-in duration-300">
      <div className="px-4 sm:px-5 flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-lg font-bold leading-snug text-gray-900">
          {t('support.status.title', "We've got you")}
          <Heart className="w-5 h-5 fill-amber-400 text-amber-400" aria-hidden />
        </h3>
        <p className="text-sm leading-relaxed text-gray-800">
          {t(
            'support.status.body',
            "Your request has been sent to our team. We'll get back to you as soon as we can, typically within 24–48 hours, excluding weekends and holidays.",
          )}
        </p>
        <p className="text-sm leading-relaxed text-gray-800">
          {t('support.status.sooner', "We'll do our best to respond sooner.")}
        </p>
      </div>

      {status.experts.length > 0 && (
        <>
          <div className="h-px bg-indigo-100 mx-4 sm:mx-5 my-4" />
          <h4 className="px-4 sm:px-5 pb-2.5 text-sm font-bold text-gray-900">
            {t('support.status.featuredExperts', 'Featured Experts')}
          </h4>
          <div className="flex gap-2.5 overflow-x-auto px-4 sm:px-5 pb-1.5 [scrollbar-width:none]">
            {status.experts.map((e) => (
              <ExpertChip key={e.id} expert={e} onOpen={() => navigate(`/experts/${e.id}`)} />
            ))}
          </div>
        </>
      )}

      {status.products.length > 0 && (
        <>
          <h4 className="px-4 sm:px-5 pt-3 pb-2 text-sm font-bold text-gray-900">
            {t('support.status.resources', 'Resources for You')}
          </h4>
          <div className="px-4 sm:px-5 flex flex-col gap-2">
            {status.products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/products/${p.id}`)}
                className="w-full flex items-center gap-3 rounded-xl border border-indigo-100 bg-white px-3.5 py-3 text-left hover:border-indigo-600 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 leading-snug truncate">{p.title}</div>
                  {p.expert_name && <div className="text-xs text-gray-600 mt-0.5 truncate">{p.expert_name}</div>}
                </div>
                <span className="flex-shrink-0 inline-flex items-center h-6 px-2.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold">
                  {kindLabel(p, t)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="h-px bg-indigo-100 mx-4 sm:mx-5 my-4" />
      <p className="px-4 sm:px-5 text-[13px] leading-relaxed text-gray-800">
        {t(
          'support.status.genie',
          "We're happy to keep talking with you through our AI Chat Genie anytime. Our team is working in the background to customize recommendations for you.",
        )}
      </p>
    </section>
  );
};

const ExpertChip: React.FC<{ expert: SupportExpert; onOpen: () => void }> = ({ expert, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className="flex-shrink-0 w-[148px] flex flex-col gap-2.5 rounded-xl border border-indigo-100 bg-white px-3 py-3.5 text-left hover:border-indigo-600 hover:shadow-sm transition"
  >
    {expert.image ? (
      <img src={expert.image} alt="" className="w-11 h-11 rounded-full object-cover" />
    ) : (
      <div className="w-11 h-11 rounded-full bg-peach-500 text-gray-900 flex items-center justify-center text-[15px] font-bold">
        {initials(expert.name)}
      </div>
    )}
    <div>
      <div className="text-sm font-bold text-gray-900 leading-snug">{expert.name}</div>
      {expert.role && <div className="text-xs text-gray-600 leading-snug mt-0.5">{expert.role}</div>}
    </div>
  </button>
);

export default SupportStatusCard;
