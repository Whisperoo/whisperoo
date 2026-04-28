import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Scaffold data used as fallback when no real checklist data exists yet
const SCAFFOLD_DATA = [
  { month: 'Jan', rate: 78 },
  { month: 'Feb', rate: 81 },
  { month: 'Mar', rate: 80 },
  { month: 'Apr', rate: 83 },
  { month: 'May', rate: 85 },
  { month: 'Jun', rate: 84 },
];

interface SurveyCompletionChartProps {
  /** Monthly checklist completion trend from fn_get_admin_dashboard → checklist_trend */
  data: { month: string; rate: number }[];
}

const SurveyCompletionChart: React.FC<SurveyCompletionChartProps> = ({ data }) => {
  const hasRealData  = data.length > 0;
  const chartData    = hasRealData ? data : SCAFFOLD_DATA;
  const isScaffolded = !hasRealData;

  return (
    <div className="relative">
      {isScaffolded && (
        <div className="absolute top-0 right-0 z-10">
          <span className="text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5">
            Estimated
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
            formatter={(v: number) => [`${v}%`, isScaffolded ? 'Estimated Rate' : 'Completion Rate']}
          />
          <Bar dataKey="rate" radius={[4, 4, 0, 0]} name="Completion %">
            {chartData.map((_, i) => (
              <Cell
                key={i}
                fill={isScaffolded ? '#34D399' : '#22C55E'}
                fillOpacity={isScaffolded ? 0.5 : 0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SurveyCompletionChart;
