import React, { useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * "Meet {name}" intro video on the expert profile (client screenshot, 2026-10-03).
 * Poster state: black frame, white play button, duration bottom-left. Pressing play
 * hands over to the browser's native controls. The caller decides visibility
 * (expert_video_enabled AND expert_video_url).
 */

const fmt = (secs: number) => {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const ExpertIntroVideo: React.FC<{ src: string; firstName: string }> = ({ src, firstName }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  const play = () => {
    setStarted(true);
    ref.current?.play().catch((e) => console.error('Intro video: play failed', e));
  };

  return (
    <section className="mt-6" aria-labelledby="expert-intro-video">
      <h2 id="expert-intro-video" className="text-2xl font-semibold text-gray-900">
        {t('experts.introVideo.title', 'Meet {{name}}', { name: firstName })}
      </h2>
      <p className="text-gray-500 mt-1 mb-4">{t('experts.introVideo.subtitle', 'An introduction to your expert:')}</p>
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black">
        <video
          ref={ref}
          src={src}
          preload="metadata"
          playsInline
          controls={started}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onError={() => setFailed(true)}
          className="w-full h-full object-contain"
        />
        {!started && (
          <button
            type="button"
            onClick={play}
            aria-label={t('experts.introVideo.play', 'Play introduction video')}
            className="absolute inset-0 flex items-center justify-center group"
          >
            <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
              <Play className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600 fill-indigo-600 ml-1" />
            </span>
            {duration !== null && Number.isFinite(duration) && (
              <span className="absolute left-5 bottom-4 text-white text-sm font-semibold tabular-nums">{fmt(duration)}</span>
            )}
          </button>
        )}
      </div>
    </section>
  );
};

export default ExpertIntroVideo;
