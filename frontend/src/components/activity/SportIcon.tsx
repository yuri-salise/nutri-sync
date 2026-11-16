import React from 'react';
import { Activity, Bike, Footprints, Mountain } from 'lucide-react';
import { SportType } from '../../types';

const ICONS = { run: Activity, walk: Footprints, ride: Bike, hike: Mountain } as const;

export const SportIcon: React.FC<{ sport?: SportType | string | null; className?: string }> = ({
  sport,
  className = 'h-5 w-5',
}) => {
  const Icon = ICONS[(sport as SportType) ?? 'run'] ?? Activity;
  return <Icon className={className} aria-hidden="true" />;
};
