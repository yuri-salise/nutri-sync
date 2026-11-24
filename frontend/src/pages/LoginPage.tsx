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
    <div className="min-h-screen bg-page flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden selection:bg-accent selection:text-on-accent">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(29,78,216,0.06)_0%,transparent_70%)] pointer-events-none" />

      <div
        className="animate-rise w-full max-w-md space-y-6 relative z-10"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-accent via-success to-info p-[2px] shadow-neu-sm">
            <div className="h-full w-full bg-page rounded-[14px] flex items-center justify-center">
              <Activity className="h-7 w-7 text-accent" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-ink ">
            Welcome to NutriSync
          </h1>
          <p className="text-xs text-muted">
            Smart Workout, Run & Nutrition Tracking
          </p>
        </div>

        {/* 1-Click Evaluation Demo Credentials Banner */}
        <div className="p-4 rounded-3xl bg-card border border-line shadow-neu space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-accent" /> Quick Demo Login
            </span>
            <span className="text-[11px] tabular-nums text-accent">Password123!</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleQuickAthlete}
              disabled={loading}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-well hover:bg-card-hover border border-line hover:border-accent/40 text-xs font-semibold text-ink hover:text-accent transition-all"
            >
              <User className="h-3.5 w-3.5 text-accent" />
              <span>Athlete Yuri</span>
            </button>
            <button
              type="button"
              onClick={handleQuickAdmin}
              disabled={loading}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-well hover:bg-card-hover border border-line hover:border-info/40 text-xs font-semibold text-ink hover:text-info transition-all"
            >
              <Shield className="h-3.5 w-3.5 text-info" />
              <span>Coach Rinante</span>
            </button>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-card border border-line shadow-2xl space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="athlete@nutrisync.com"
                  className="w-full bg-well border border-line focus:border-accent rounded-2xl pl-10 pr-4 py-3 text-xs text-ink placeholder-muted focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-well border border-line focus:border-accent rounded-2xl pl-10 pr-4 py-3 text-xs text-ink placeholder-muted focus:outline-none transition-colors tabular-nums"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-accent text-on-accent font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-neu-sm hover:bg-accent-hover transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Account'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="text-center text-xs text-muted">
            New to NutriSync?{' '}
            <Link to="/register" className="text-accent font-semibold hover:underline">
              Create athlete account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
