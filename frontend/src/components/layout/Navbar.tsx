import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Activity, Shield, User, LogOut, Menu, X, Sparkles, Database } from 'lucide-react';

interface NavbarProps {
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu, isMobileMenuOpen }) => {
  const { user, role, logout, quickLoginAthlete, quickLoginAdmin } = useAuth();
  const [dbHealthy, setDbHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    api.getHealth()
      .then((res) => setDbHealthy(res.database === 'connected'))
      .catch(() => setDbHealthy(false));
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-athletic-border bg-[#0a0d14]/90 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileMenu}
            className="p-2 text-athletic-muted hover:text-white lg:hidden rounded-lg hover:bg-slate-800/60 focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          <Link to="/" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 p-0.5 shadow-glow-emerald">
              <div className="h-full w-full bg-[#0a0d14] rounded-[10px] flex items-center justify-center">
                <Activity className="h-5 w-5 text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-400 bg-clip-text text-transparent">
                NutriSync<span className="text-emerald-400 font-extrabold text-xs ml-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">RAG</span>
              </span>
            </div>
          </Link>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-3">
          {/* Health status badge (Requirement B8) */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-slate-900 border border-athletic-border text-athletic-muted">
            <Database className="h-3.5 w-3.5 text-cyan-400" />
            <span>DB:</span>
            <span className={`inline-block h-2 w-2 rounded-full ${dbHealthy ? 'bg-emerald-400 shadow-glow-emerald animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-slate-300">{dbHealthy ? 'PostgreSQL 17' : 'Offline'}</span>
          </div>

          {/* Quick Demo Switcher (Instant Evaluation for Defense Panel) */}
          <div className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-athletic-border text-xs">
            <span className="px-2 text-athletic-muted flex items-center gap-1 font-medium">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Demo:
            </span>
            <button
              onClick={quickLoginAthlete}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                role === 'athlete'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-athletic-muted hover:text-white'
              }`}
            >
              Athlete
            </button>
            <button
              onClick={quickLoginAdmin}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                role === 'admin'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-athletic-muted hover:text-white'
              }`}
            >
              Coach/Admin
            </button>
          </div>

          {/* User profile & Logout */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-900/90 border border-athletic-border px-3 py-1.5 rounded-xl">
                <div className={`p-1 rounded-md ${role === 'admin' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {role === 'admin' ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className="hidden sm:block text-left text-xs">
                  <p className="font-semibold text-slate-200 leading-tight">{user.full_name}</p>
                  <p className="text-athletic-muted capitalize">{role}</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-2 text-athletic-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors border border-transparent hover:border-rose-500/20"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-colors shadow-glow-emerald"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
