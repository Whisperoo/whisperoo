import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

interface ThemeEntry { category: string; count: number }

const BAR_COLORS = ['#4A6FA5', '#34D399', '#F59E0B', '#818CF8', '#F87171', '#94A3B8', '#60A5FA', '#A78BFA'];

const ConcernThemesChart: React.FC<{ data: ThemeEntry[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No theme data yet — messages will be categorized as users chat
      </div>
    );
  }

  // Sort by count descending, take top 7
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 7);

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, sorted.length * 36)}>
      <BarChart
        layout="vertical"
        data={sorted}
        margin={{ top: 4, right: 40, bottom: 4, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          dataKey="category"
          type="category"
          width={130}
          tick={{ fontSize: 11, fill: '#4B5563' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
          formatter={(v: number) => [v, 'Messages']}
          cursor={{ fill: '#F8FAFC' }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Messages">
          {sorted.map((_, i) => (
            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ConcernThemesChart;
