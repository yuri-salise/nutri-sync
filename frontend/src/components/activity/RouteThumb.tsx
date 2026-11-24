import React, { useMemo } from 'react';

interface RouteThumbProps {
  points: [number, number][]; // [lat, lng]
  color?: string;
  className?: string;
  label?: string;
}

/** Lightweight SVG preview of a GPS route (no map tiles, so a long feed stays fast). */
export const RouteThumb: React.FC<RouteThumbProps> = ({
  points,
  color = '#2F74E8',
  className = 'w-full h-full',
  label = 'Route map preview',
}) => {
  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const midLat = points.reduce((s, p) => s + p[0], 0) / points.length;
    const k = Math.cos((midLat * Math.PI) / 180);
    const xy = points.map(([lat, lng]) => [lng * k, -lat] as [number, number]);
    const xs = xy.map((p) => p[0]);
    const ys = xy.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const w = Math.max(Math.max(...xs) - minX, 1e-9);
    const h = Math.max(Math.max(...ys) - minY, 1e-9);
    const size = 100;
    const pad = 8;
    const scale = (size - pad * 2) / Math.max(w, h);
    const ox = (size - w * scale) / 2;
    const oy = (size - h * scale) / 2;
    const mapped = xy.map(([x, y]) => [ox + (x - minX) * scale, oy + (y - minY) * scale] as [number, number]);
    return { mapped, size };
  }, [points]);

  if (!geometry) return null;
  const { mapped, size } = geometry;
  const d = mapped.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const start = mapped[0];
  const end = mapped[mapped.length - 1];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={start[0]} cy={start[1]} r="2.6" fill="#059669" />
      <circle cx={end[0]} cy={end[1]} r="2.6" fill="#E0424F" />
    </svg>
  );
};

export const parseRoute = (geojson?: string | null): [number, number][] => {
  if (!geojson) return [];
  try {
    const data = JSON.parse(geojson);
    const coords: number[][] = Array.isArray(data?.coordinates) ? data.coordinates : [];
    const pts = coords.map((c) => [Number(c[1]), Number(c[0])] as [number, number]);
    if (pts.length <= 150) return pts;
    const step = (pts.length - 1) / 149;
    return Array.from({ length: 150 }, (_, i) => pts[Math.round(i * step)]);
  } catch {
    return [];
  }
};
