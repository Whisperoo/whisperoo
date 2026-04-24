import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Dot,
} from 'recharts';

interface DataPoint { month: string; rate: number }

const ESCALATION_THRESHOLD = 15; // % — clinical threshold for intervention

const EscalationTrendChart: React.FC<{ data: DataPoint[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        No escalation data yet
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
            formatter={(v: number) => [`${v}%`, 'Escalation Rate']}
          />
          <ReferenceLine
            y={ESCALATION_THRESHOLD}
            stroke="#F59E0B"
            strokeDasharray="4 3"
            label={{ value: `Threshold ${ESCALATION_THRESHOLD}%`, position: 'right', fontSize: 10, fill: '#F59E0B' }}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="#F59E0B"
            strokeWidth={2.5}
            dot={<Dot r={4} fill="#F59E0B" stroke="#fff" strokeWidth={2} />}
            activeDot={{ r: 6, fill: '#F59E0B' }}
            name="Escalation %"
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-400 mt-1">
        ↑ Signals above {ESCALATION_THRESHOLD}% may require clinical outreach intervention
      </p>
    </div>
  );
};

export default EscalationTrendChart;
