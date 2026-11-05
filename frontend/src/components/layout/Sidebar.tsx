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
  ShieldAlert,
  Lock,
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
    { name: 'RAG Nutrition AI', path: '/scanner', icon: Compass },
    { name: 'Daily Nutrition Log', path: '/nutrition', icon: UtensilsCrossed },
    { name: 'Exercise Catalog', path: '/exercises', icon: BookOpen },
    { name: 'Club Feed', path: '/community', icon: Users },
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
          className="fixed inset-0 z-30 bg-black/80 backdrop-blur-md lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-30 w-64 border-r border-[#1e232d] bg-[#000000] flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="py-6 px-4 space-y-6 overflow-y-auto">
          {/* Main Navigation */}
          <div>
            <div className="flex items-center justify-between px-3">
              <p className="text-[10px] font-mono font-bold tracking-widest text-[#848E9C] uppercase">
                Exchange Telemetry
              </p>
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#C8FF00] animate-ping" />
            </div>
            <nav className="mt-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                        isActive
                          ? 'bg-[#12151b] text-[#C8FF00] border border-[#C8FF00]/40 shadow-glow-lime'
                          : 'text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#12151b]/60 border border-transparent'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                      <span>{item.name}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#848E9C]" />
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Quick Telemetry Card */}
          <div className="p-4 rounded-2xl bg-[#0d1015] border border-[#1e232d] space-y-2.5 shadow-okx-card">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#848E9C] flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[#C8FF00]" /> RLS Security
              </span>
              <span className="text-[#00D26A] font-bold">STRICT</span>
            </div>
            <div className="w-full bg-[#1e232d] rounded-full h-1 overflow-hidden">
              <div className="bg-gradient-to-r from-[#C8FF00] to-[#00D26A] h-1 rounded-full w-full" />
            </div>
            <div className="flex justify-between text-[10px] text-[#848E9C] font-mono">
              <span>pgvector 384d</span>
              <span>USDA & FNRI</span>
            </div>
          </div>
        </div>

        {/* Bottom System Footer */}
        <div className="p-4 border-t border-[#1e232d] bg-[#07080a] text-center">
          <p className="text-[10px] font-mono text-[#848E9C]">
            NutriSync-RAG &bull; BSIT 4A
          </p>
          <p className="text-[9px] font-mono text-[#C8FF00]/70 mt-0.5">
            Yuri D. Salise &bull; OKX Cyber Theme
          </p>
        </div>
      </aside>
    </>
  );
};
