import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Dumbbell,
  Compass,
  MapPin,
  UtensilsCrossed,
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Workouts', path: '/workouts', icon: Dumbbell },
    { name: 'Runs', path: '/runs', icon: MapPin },
    { name: 'Scan Meal', path: '/scanner', icon: Compass },
    { name: 'Food Log', path: '/nutrition', icon: UtensilsCrossed },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#000000]/95 backdrop-blur-xl border-t border-[#1e232d] px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-medium transition-all ${
                  isActive
                    ? 'text-[#C8FF00]'
                    : 'text-[#848E9C] hover:text-[#EAECEF]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1 rounded-lg transition-transform ${
                      isActive ? 'bg-[#C8FF00]/15 scale-110 shadow-glow-lime' : ''
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="mt-0.5 tracking-tight font-semibold">{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
