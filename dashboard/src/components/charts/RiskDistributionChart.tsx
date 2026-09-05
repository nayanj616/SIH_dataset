import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { RISK_COLORS } from '../../lib/constants';
import type { RiskLevel } from '../../lib/types';

interface RiskCounts {
  high_risk_works: number;
  elevated_risk_works: number;
  moderate_risk_works: number;
  low_risk_works: number;
}

interface RiskDistributionChartProps {
  data: RiskCounts;
}

const LEVEL_KEYS: { level: RiskLevel; key: keyof RiskCounts }[] = [
  { level: 'High Risk', key: 'high_risk_works' },
  { level: 'Elevated Risk', key: 'elevated_risk_works' },
  { level: 'Moderate', key: 'moderate_risk_works' },
  { level: 'Low / Normal', key: 'low_risk_works' },
];

export function RiskDistributionChart({ data }: RiskDistributionChartProps) {
  const chartData = LEVEL_KEYS.map(({ level, key }) => ({
    name: level,
    value: data[key] ?? 0,
    color: RISK_COLORS[level].hex,
  }));

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} barCategoryGap="30%">
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: '#1e293b',
              border: 'none',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '12px',
              padding: '8px 12px',
            }}
            cursor={{ fill: 'rgba(99,102,241,0.06)' }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Works">
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-4 mt-2">
        {chartData.map(({ name, value, color }) => (
          <div key={name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs text-slate-600">
              {name}: <strong className="text-slate-800">{value}</strong>
              {total > 0 && (
                <span className="text-slate-400 ml-1">({((value / total) * 100).toFixed(0)}%)</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
