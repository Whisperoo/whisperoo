import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Scaffolded — survey data not yet available. Renders placeholder shape with estimated badge.
const SCAFFOLD_DATA = [
  { month: 'Jan', rate: 78 },
  { month: 'Feb', rate: 81 },
  { month: 'Mar', rate: 80 },
  { month: 'Apr', rate: 83 },
  { month: 'May', rate: 85 },
  { month: 'Jun', rate: 84 },
];

const SurveyCompletionChart: React.FC = () => (
  <div className="relative">
    <div className="absolute top-0 right-0 z-10">
      <span className="text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5">
        Estimated
      </span>
    </div>
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={SCAFFOLD_DATA} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
          formatter={(v: number) => [`${v}%`, 'Completion Rate']}
        />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]} name="Completion %">
          {SCAFFOLD_DATA.map((_, i) => (
            <Cell key={i} fill="#34D399" fillOpacity={0.7} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default SurveyCompletionChart;
