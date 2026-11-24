import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Dumbbell,
  Compass,
  MapPin,
  UtensilsCrossed,
  Users,
  ShieldCheck,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { role } = useAuth();

  const athleteNavItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Workouts', path: '/workouts', icon: Dumbbell },
    { name: 'Record Activity', path: '/record', icon: MapPin },
    { name: 'Smart Meal Scanner', path: '/scanner', icon: Compass },
    { name: 'Daily Food Log', path: '/nutrition', icon: UtensilsCrossed },
    { name: 'Community', path: '/community', icon: Users },
  ];

  const adminNavItems = [
    { name: 'Coach Dashboard', path: '/admin', icon: ShieldCheck, adminOnly: true },
  ];

  const navItems = role === 'admin' ? [...athleteNavItems, ...adminNavItems] : athleteNavItems;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-md lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-30 w-64 border-r border-line bg-page flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="py-6 px-4 space-y-6 overflow-y-auto">
          {/* Main Navigation */}
          <div>
            <div className="flex items-center justify-between px-3">
              <p className="text-[10px] tabular-nums font-bold tracking-widest text-muted uppercase">
                Menu
              </p>
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
                          ? 'bg-card text-accent border border-accent/40 shadow-neu-sm'
                          : 'text-muted hover:text-ink hover:bg-card/60 border border-transparent'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                      <span>{item.name}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted" />
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom footer: food data sources the scanner really uses */}
        <div className="p-4 border-t border-line bg-well text-center space-y-0.5">
          <p className="text-[11px] font-semibold text-ink tracking-wide">NutriSync</p>
          <p className="text-[10px] text-muted">Food data: DOST-FNRI and USDA</p>
        </div>
      </aside>
    </>
  );
};
