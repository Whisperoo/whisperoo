import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SubMetric {
  label: string;
  value?: string | number;
  delta?: number;
  hasInfo?: boolean;
}

interface KpiCardProps {
  title: string;
  subtitle?: string;
  value: string | number | null;
  delta?: number | null;
  subMetrics?: SubMetric[];
  scaffolded?: boolean;
  className?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  tooltip?: string;  // how this metric is calculated
}

const DeltaBadge: React.FC<{ delta: number; small?: boolean }> = ({ delta, small }) => {
  const isPositive = delta > 0;
  const isZero = delta === 0;
  const cls = small ? 'text-xs' : 'text-xs font-semibold';

  if (isZero) return (
    <span className={`${cls} text-gray-400 flex items-center gap-0.5`}>
      <Minus className="w-3 h-3" /> 0%
    </span>
  );

  return (
    <span className={`${cls} flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${isPositive ? 'bg-green-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
      {isPositive
        ? <TrendingUp className="w-3 h-3" />
        : <TrendingDown className="w-3 h-3" />}
      {isPositive ? '+' : ''}{delta}%
    </span>
  );
};

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  subtitle,
  value,
  delta,
  subMetrics,
  scaffolded = false,
  className = '',
  valuePrefix = '',
  valueSuffix = '',
  tooltip,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const { t } = useTranslation();
  const displayValue = value === null || value === undefined
    ? '—'
    : `${valuePrefix}${value}${valueSuffix}`;

  return (
    <div className={`bg-white rounded-[16px] border border-gray-200 shadow-sm p-5 flex flex-col gap-4 ${className}`}>
      {/* Header Area */}
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium text-gray-700 leading-tight">
              {title}
            </p>
            {/* Info icon with tooltip */}
            {tooltip && (
              <div className="relative">
                <button
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onFocus={() => setShowTooltip(true)}
                  onBlur={() => setShowTooltip(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                  aria-label={`How ${title} is calculated`}
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                {showTooltip && (
                  <div className="absolute left-0 top-5 z-50 w-56 bg-gray-900 text-white text-[11px] leading-relaxed rounded-lg px-3 py-2.5 shadow-xl">
                    <p className="font-semibold mb-1 text-gray-200">{t('admin.kpi.howCalculated')}</p>
                    <p>{tooltip}</p>
                    <div className="absolute -top-1.5 left-2 w-3 h-3 bg-gray-900 rotate-45" />
                  </div>
                )}
              </div>
            )}
            {!tooltip && <Info className="w-3.5 h-3.5 text-gray-300" />}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {scaffolded && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5">
                {t('admin.kpi.estimated')}
              </span>
            )}
            {delta !== null && delta !== undefined && !scaffolded && (
              <DeltaBadge delta={delta} />
            )}
          </div>
        </div>
        {subtitle && (
          <p className="text-xs text-gray-400">{subtitle}</p>
        )}
      </div>

      {/* Value */}
      <p className={`text-[40px] font-normal tracking-tight leading-none ${value === null ? 'text-gray-300' : 'text-gray-800'}`}>
        {displayValue}
      </p>

      {/* Sub-metrics */}
      {subMetrics && subMetrics.length > 0 && (
        <div className="flex flex-col gap-2.5 pt-4 border-t border-gray-100 mt-2">
          {subMetrics.map((sm, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-sm font-medium text-gray-600">{sm.label}</span>
                {sm.hasInfo && <Info className="w-3.5 h-3.5 text-gray-400" />}
              </div>
              <div className="flex items-center gap-3">
                {sm.value !== undefined && sm.value !== '' && (
                  <span className="text-sm font-medium text-gray-800">{sm.value}</span>
                )}
                {sm.delta !== undefined && <DeltaBadge delta={sm.delta} small />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KpiCard;
