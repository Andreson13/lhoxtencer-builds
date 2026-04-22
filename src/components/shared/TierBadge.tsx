import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Star, AlertTriangle } from 'lucide-react';

export type GuestTier = 'regular' | 'silver' | 'gold' | 'vip' | 'blacklist';

const TIER_CONFIG: Record<GuestTier, {
  label: string;
  className: string;
  icon?: React.ReactNode;
}> = {
  regular: { label: 'Régulier', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  silver: { label: 'Silver', className: 'bg-slate-200 text-slate-700 border-slate-300' },
  gold: { label: 'Gold', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  vip: {
    label: 'VIP',
    className: 'bg-purple-100 text-purple-700 border-purple-300',
    icon: <Star className="h-3 w-3 fill-purple-500 text-purple-500" />,
  },
  blacklist: {
    label: 'Blacklist',
    className: 'bg-red-100 text-red-700 border-red-300',
    icon: <AlertTriangle className="h-3 w-3 text-red-600" />,
  },
};

interface TierBadgeProps {
  tier?: GuestTier | string | null;
  showLabel?: boolean;
}

export const TierBadge: React.FC<TierBadgeProps> = ({ tier, showLabel = true }) => {
  const t = (tier as GuestTier) || 'regular';
  const config = TIER_CONFIG[t] || TIER_CONFIG.regular;

  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1 text-xs font-medium ${config.className}`}
    >
      {config.icon}
      {showLabel && config.label}
    </Badge>
  );
};

export const getTierColor = (tier?: string | null): string => {
  switch (tier) {
    case 'silver': return '#94a3b8';
    case 'gold': return '#d97706';
    case 'vip': return '#7c3aed';
    case 'blacklist': return '#dc2626';
    default: return '#6b7280';
  }
};
