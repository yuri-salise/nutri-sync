import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Activity, Lock, Mail, AlertCircle, ArrowRight, Sparkles, Shield, User } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, quickLoginAthlete, quickLoginAdmin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email address and password.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAthlete = async () => {
    setError(null);
    setLoading(true);
    try {
      await quickLoginAthlete();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate as athlete.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdmin = async () => {
    setError(null);
    setLoading(true);
    try {
      await quickLoginAdmin();
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate as coach/admin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden font-poppins selection:bg-[#C8FF00] selection:text-black">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(200,255,0,0.06)_0%,transparent_70%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-6 relative z-10"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-[#C8FF00] via-[#00D26A] to-[#00E5FF] p-[2px] shadow-glow-lime">
            <div className="h-full w-full bg-[#000000] rounded-[14px] flex items-center justify-center">
              <Activity className="h-7 w-7 text-[#C8FF00]" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white font-poppins">
            Welcome to NutriSync
          </h1>
          <p className="text-xs text-[#848E9C]">
            Smart Workout, Run & Nutrition Tracking
          </p>
        </div>

        {/* 1-Click Evaluation Demo Credentials Banner */}
        <div className="p-4 rounded-3xl bg-[#12151b] border border-[#1e232d] shadow-cyber-card space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#C8FF00]" /> Quick Demo Login
            </span>
            <span className="text-[11px] font-mono text-[#C8FF00]">Password123!</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleQuickAthlete}
              disabled={loading}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#07080a] hover:bg-[#181c24] border border-[#1e232d] hover:border-[#C8FF00]/40 text-xs font-semibold text-white hover:text-[#C8FF00] transition-all"
            >
              <User className="h-3.5 w-3.5 text-[#C8FF00]" />
              <span>Athlete Yuri</span>
            </button>
            <button
              type="button"
              onClick={handleQuickAdmin}
              disabled={loading}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#07080a] hover:bg-[#181c24] border border-[#1e232d] hover:border-[#00E5FF]/40 text-xs font-semibold text-white hover:text-[#00E5FF] transition-all"
            >
              <Shield className="h-3.5 w-3.5 text-[#00E5FF]" />
              <span>Coach Rinante</span>
            </button>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#12151b] border border-[#1e232d] shadow-2xl space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-[#F6465D]/10 border border-[#F6465D]/30 text-[#F6465D] text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#848E9C]">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[#848E9C]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="athlete@nutrisync.com"
                  className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-[#848E9C] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#848E9C]">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[#848E9C]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-[#848E9C] focus:outline-none transition-colors font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-[#C8FF00] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-glow-lime hover:bg-[#d4ff33] transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Account'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="text-center text-xs text-[#848E9C]">
            New to NutriSync?{' '}
            <Link to="/register" className="text-[#C8FF00] font-semibold hover:underline">
              Create athlete account
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
