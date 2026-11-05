import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Dumbbell,
  Compass,
  MapPin,
  UtensilsCrossed,
  BookOpen,
  Users,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { role } = useAuth();

  const athleteNavItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Strength & PRs', path: '/workouts', icon: Dumbbell },
    { name: 'GPS Run Tracker', path: '/runs', icon: MapPin },
    { name: 'RAG Nutrition Scanner', path: '/scanner', icon: Compass },
    { name: 'Daily Nutrition Log', path: '/nutrition', icon: UtensilsCrossed },
    { name: 'Exercise Catalog', path: '/exercises', icon: BookOpen },
    { name: 'Community Splits', path: '/community', icon: Users },
  ];

  const adminNavItems = [
    { name: 'Coach & Audit Hub', path: '/admin', icon: ShieldCheck, adminOnly: true },
  ];

  const navItems = role === 'admin' ? [...athleteNavItems, ...adminNavItems] : athleteNavItems;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-30 w-64 border-r border-athletic-border bg-[#0a0d14] flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="py-6 px-4 space-y-6 overflow-y-auto">
          {/* Main Navigation */}
          <div>
            <p className="px-3 text-[11px] font-semibold tracking-wider text-athletic-muted uppercase">
              Athletic Performance
            </p>
            <nav className="mt-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 text-emerald-400 border border-emerald-500/30 shadow-glow-emerald'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-athletic-muted group-hover:text-emerald-400 transition-colors" />
                      <span>{item.name}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-athletic-muted" />
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Quick Stats Pill */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-athletic-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-athletic-muted">RAG Vector Base</span>
              <span className="text-emerald-400 font-mono font-bold">pgvector 384d</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-400 to-cyan-400 h-1.5 rounded-full w-full animate-pulse" />
            </div>
            <div className="flex justify-between text-[11px] text-athletic-muted font-mono">
              <span>FNRI & USDA Grounded</span>
              <span>100% Free/OSS</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-athletic-border text-xs text-athletic-muted font-mono flex items-center justify-between">
          <span>ITSD 85 Capstone</span>
          <span className="text-emerald-400/80">v1.0.0</span>
        </div>
      </aside>
    </>
  );
};
