import type { RiskLevel } from '../../lib/types';
import { RISK_COLORS } from '../../lib/constants';

interface RiskBadgeProps {
  level: RiskLevel | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

export function RiskBadge({ level, size = 'md' }: RiskBadgeProps) {
  if (!level) return <span className="text-slate-400 text-xs">—</span>;

  const colors = RISK_COLORS[level];
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5',
  }[size];

  return (
    <span className={`inline-flex items-center font-semibold rounded border whitespace-nowrap ${colors.badge} ${sizeClasses}`}>
      {level}
    </span>
  );
}
