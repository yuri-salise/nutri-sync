import React from 'react';

const COLORS = ['#2F74E8', '#0891B2', '#C2700C', '#7C5CE0', '#059669', '#E0561E'];

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
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
};
