import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot,
} from 'recharts';

interface DataPoint { month: string; count: number }

const EnrollmentTrendChart: React.FC<{ data: DataPoint[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        No enrollment data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#4A6FA5"
          strokeWidth={2.5}
          dot={<Dot r={4} fill="#4A6FA5" stroke="#fff" strokeWidth={2} />}
          activeDot={{ r: 6, fill: '#4A6FA5' }}
          name="Enrolled"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default EnrollmentTrendChart;
