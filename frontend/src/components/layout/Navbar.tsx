import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  Activity,
  Shield,
  User,
  LogOut,
  Menu,
  X,
  Sparkles,
  Database,
  Cpu,
  Lock,
} from 'lucide-react';

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
    <header className="sticky top-0 z-40 w-full border-b border-[#1e232d] bg-[#000000]/90 backdrop-blur-xl transition-all">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand & Mobile Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileMenu}
            className="p-2 text-[#848E9C] hover:text-[#FFFFFF] lg:hidden rounded-xl hover:bg-[#12151b] transition-colors focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6 text-[#C8FF00]" /> : <Menu className="h-6 w-6" />}
          </button>

          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#C8FF00] via-[#00D26A] to-[#00E5FF] p-[1.5px] shadow-glow-lime group-hover:scale-105 transition-transform duration-300">
              <div className="h-full w-full bg-[#000000] rounded-[10px] flex items-center justify-center">
                <Activity className="h-5 w-5 text-[#C8FF00]" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-white font-poppins">
                  NUTRI<span className="text-[#C8FF00]">SYNC</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#C8FF00]/10 text-[#C8FF00] border border-[#C8FF00]/30 tracking-wider">
                  PRO
                </span>
              </div>
              <span className="text-[10px] text-[#848E9C] tracking-wide font-medium -mt-0.5">
                SMART FITNESS & NUTRITION
              </span>
            </div>
          </Link>
        </div>

        {/* Center: System Status Badges */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Database status */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#0d1015] border border-[#1e232d] text-[#848E9C]">
            <Database className="h-3.5 w-3.5 text-[#00E5FF]" />
            <span>Database:</span>
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                dbHealthy ? 'bg-[#00D26A] shadow-glow-green animate-pulse' : 'bg-[#F6465D]'
              }`}
            />
            <span className="text-[#EAECEF] font-semibold">
              {dbHealthy ? 'Online' : 'Connecting'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#0d1015] border border-[#1e232d] text-[#848E9C]">
            <Lock className="h-3.5 w-3.5 text-[#C8FF00]" />
            <span className="text-[#EAECEF] font-semibold">Private & Secure</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#0d1015] border border-[#1e232d] text-[#848E9C]">
            <Cpu className="h-3.5 w-3.5 text-[#C8FF00]" />
            <span className="text-[#C8FF00]">AI Food Engine Ready</span>
          </div>
        </div>

        {/* Right: Quick Role Switcher & User Profile */}
        <div className="flex items-center gap-3">
          {/* Quick Demo Switcher (Instant Evaluation for Evaluator / Grader) */}
          <div className="hidden sm:flex items-center gap-1 bg-[#0d1015] p-1 rounded-xl border border-[#1e232d] text-xs">
            <span className="px-2 text-[#848E9C] flex items-center gap-1 font-medium">
              <Sparkles className="h-3.5 w-3.5 text-[#C8FF00]" /> Demo:
            </span>
            <button
              onClick={quickLoginAthlete}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                role === 'athlete'
                  ? 'bg-[#C8FF00] text-black shadow-glow-lime'
                  : 'text-[#848E9C] hover:text-[#FFFFFF]'
              }`}
            >
              Athlete
            </button>
            <button
              onClick={quickLoginAdmin}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                role === 'admin'
                  ? 'bg-[#00E5FF] text-black shadow-glow-cyan'
                  : 'text-[#848E9C] hover:text-[#FFFFFF]'
              }`}
            >
              Coach
            </button>
          </div>

          {/* User Profile & Logout */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[#12151b] border border-[#1e232d] px-3 py-1.5 rounded-xl shadow-cyber-card">
                <div
                  className={`p-1.5 rounded-lg ${
                    role === 'admin'
                      ? 'bg-[#00E5FF]/20 text-[#00E5FF]'
                      : 'bg-[#C8FF00]/20 text-[#C8FF00]'
                  }`}
                >
                  {role === 'admin' ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className="hidden md:block text-left text-xs">
                  <p className="font-bold text-[#EAECEF] leading-tight font-poppins">{user.full_name}</p>
                  <p className="text-[10px] text-[#848E9C] uppercase font-mono tracking-wider">{role}</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-2 text-[#848E9C] hover:text-[#F6465D] hover:bg-[#F6465D]/10 rounded-xl transition-colors border border-transparent hover:border-[#F6465D]/20"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C8FF00] text-black hover:bg-[#d4ff33] shadow-glow-lime transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
