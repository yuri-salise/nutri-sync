import React from 'react';
import { ShieldCheck } from 'lucide-react';

/** Small "Coach" tag shown next to a coach's name on posts and comments. */
export const CoachBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#00E5FF]/15 border border-[#00E5FF]/40 text-[#00E5FF] text-xs font-bold align-middle whitespace-nowrap">
    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
    Coach
  </span>
);

/** "A coach approved" / "2 coaches approved", or null when no coach gave kudos. */
export const coachApprovalText = (count: number): string | null =>
  count <= 0 ? null : count === 1 ? 'A coach approved' : `${count} coaches approved`;

export const CoachApproval: React.FC<{ count: number }> = ({ count }) => {
  const text = coachApprovalText(count);
  if (!text) return null;
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/40 text-[#00E5FF] text-sm font-bold">
      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
      {text}
    </div>
  );
};
