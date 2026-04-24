import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface FeatureEntry { feature: string; count: number; pct: number }

const COLORS: Record<string, string> = {
  'AI Chat':        '#4A6FA5',
  'Resource Visits':'#34D399',
  'Expert Booking': '#F59E0B',
  'Services':       '#818CF8',
  'Other':          '#94A3B8',
};

const DEFAULT_COLOR = '#CBD5E1';

interface Props { data: FeatureEntry[] }

const FeatureUsagePie: React.FC<Props> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No usage data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={3}
          dataKey="pct"
          nameKey="feature"
        >
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={COLORS[entry.feature] ?? DEFAULT_COLOR}
              stroke="none"
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
          formatter={(v: number, name: string) => [`${v}%`, name]}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          formatter={(value, entry: any) => (
            <span className="text-xs text-gray-600">
              {value} <span className="font-semibold text-gray-800">{entry.payload.pct}%</span>
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default FeatureUsagePie;
