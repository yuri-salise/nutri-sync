import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
    <div className="min-h-[80vh] flex flex-col justify-center items-center px-4 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 p-0.5 shadow-glow-emerald">
            <div className="h-full w-full bg-[#0a0d14] rounded-[14px] flex items-center justify-center">
              <Activity className="h-6 w-6 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Welcome to NutriSync-RAG</h1>
          <p className="text-sm text-athletic-muted">
            Activity-synchronized nutritional retrieval & workout platform
          </p>
        </div>

        {/* 1-Click Evaluation Demo Credentials Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-athletic-border space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" /> Panel & Evaluation Quick Sign-In
            </span>
            <span className="text-[11px] font-mono text-emerald-400">Password123!</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleQuickAthlete}
              disabled={loading}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-800/80 hover:bg-emerald-500/10 border border-slate-700 hover:border-emerald-500/40 text-xs font-medium text-slate-200 hover:text-emerald-400 transition-all"
            >
              <User className="h-3.5 w-3.5 text-emerald-400" />
              <span>Athlete Yuri</span>
            </button>
            <button
              type="button"
              onClick={handleQuickAdmin}
              disabled={loading}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-800/80 hover:bg-cyan-500/10 border border-slate-700 hover:border-cyan-500/40 text-xs font-medium text-slate-200 hover:text-cyan-400 transition-all"
            >
              <Shield className="h-3.5 w-3.5 text-cyan-400" />
              <span>Coach Rinante</span>
            </button>
          </div>
        </div>

        {/* Error notification (Requirement F3: server errors shown, not swallowed) */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5 animate-shake">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Login Form */}
        <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-athletic-card border border-athletic-border space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-athletic-muted" /> Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="athlete@nutrisync.com"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-athletic-border text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-athletic-muted" /> Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-athletic-border text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-95 shadow-glow-emerald transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In to Account</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-athletic-muted">
          Need an athlete profile?{' '}
          <Link to="/register" className="text-emerald-400 font-medium hover:underline">
            Register new account
          </Link>
        </p>
      </div>
    </div>
  );
};
