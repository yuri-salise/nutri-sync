import React from 'react';

const COLORS = ['#1D4ED8', '#0369A1', '#92400E', '#6D28D9', '#047857', '#B93A0B'];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

/** Round initials avatar; the colour is stable per user id. */
export const Avatar: React.FC<{ name: string; id: number; size?: number }> = ({ name, id, size = 40 }) => {
  const color = COLORS[Math.abs(id) % COLORS.length];
  return (
    <div
      aria-hidden="true"
      className="rounded-full flex items-center justify-center font-bold text-on-accent shrink-0 select-none"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
};
