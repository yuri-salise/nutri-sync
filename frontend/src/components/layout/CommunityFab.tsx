import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users } from 'lucide-react';

// Pages where a floating button would sit on top of important controls (or is redundant).
const HIDDEN_ON = ['/community', '/record'];

/**
 * Always-visible shortcut to the Community feed on phones, bottom right above the nav bar.
 * Desktop already shows Community in the side panel, so this is mobile only.
 */
export const CommunityFab: React.FC<{ hidden?: boolean }> = ({ hidden = false }) => {
  const { pathname } = useLocation();
  if (hidden || HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <Link
      to="/community"
      aria-label="Open Community"
      title="Community"
      className="community-fab lg:hidden fixed right-4 z-40 h-14 w-14 rounded-full bg-accent text-on-accent shadow-neu-sm border-2 border-black/40 flex items-center justify-center active:scale-95 transition-transform"
    >
      <Users className="h-6 w-6" aria-hidden="true" />
    </Link>
  );
};
