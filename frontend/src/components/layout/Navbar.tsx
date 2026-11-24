import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { currentTheme, setTheme } from '../../utils/theme';
import {
  Moon,
  Sun,
  Activity,
  Shield,
  User,
  LogOut,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu, isMobileMenuOpen }) => {
  const { user, role, logout, quickLoginAthlete, quickLoginAdmin } = useAuth();
  const [theme, setThemeState] = useState(currentTheme);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-page/90 backdrop-blur-xl transition-all">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand & Mobile Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onToggleMobileMenu}
            className="p-2 text-muted hover:text-ink lg:hidden rounded-xl hover:bg-card transition-colors focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6 text-accent" /> : <Menu className="h-6 w-6" />}
          </button>

          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent via-success to-info p-[1.5px] shadow-neu-sm group-hover:scale-105 transition-transform duration-300">
              <div className="h-full w-full bg-page rounded-[10px] flex items-center justify-center">
                <Activity className="h-5 w-5 text-accent" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight text-ink ">
                NUTRI<span className="text-accent">SYNC</span>
              </span>
              <span className="hidden sm:block text-[10px] text-muted tracking-wide font-medium -mt-0.5">
                FITNESS & NUTRITION
              </span>
            </div>
          </Link>
        </div>

        {/* Right: Quick Role Switcher & User Profile */}
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          {/* Quick Demo Switcher (Instant Evaluation for Evaluator / Grader) */}
          <div className="hidden sm:flex items-center gap-1 bg-well p-1 rounded-xl border border-line text-xs">
            <span className="px-2 text-muted flex items-center gap-1 font-medium">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Demo:
            </span>
            <button
              onClick={quickLoginAthlete}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                role === 'athlete'
                  ? 'bg-accent text-on-accent shadow-neu-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Athlete
            </button>
            <button
              onClick={quickLoginAdmin}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                role === 'admin'
                  ? 'bg-info text-on-accent shadow-neu-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Coach
            </button>
          </div>

          <button
            onClick={toggleTheme}
            className="h-11 w-11 flex items-center justify-center rounded-xl text-muted hover:text-ink hover:bg-card-hover transition-colors"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* User Profile & Logout */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 bg-card border border-line px-3 py-1.5 rounded-xl shadow-neu">
                <div
                  className={`p-1.5 rounded-lg ${
                    role === 'admin'
                      ? 'bg-info/20 text-info'
                      : 'bg-accent/20 text-accent'
                  }`}
                >
                  {role === 'admin' ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className="hidden md:block text-left text-xs">
                  <p className="font-bold text-ink leading-tight ">{user.full_name}</p>
                  <p className="text-[10px] text-muted uppercase tabular-nums tracking-wider">{role}</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-xl transition-colors border border-transparent hover:border-danger/20"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-accent text-on-accent hover:bg-accent-hover shadow-neu-sm transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
