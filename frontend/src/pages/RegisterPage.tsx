import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, Mail, Lock, User, Scale, Flame, ArrowRight, AlertCircle } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [weightKg, setWeightKg] = useState('72.0');
  const [baseKcal, setBaseKcal] = useState('2200');
  const [proteinG, setProteinG] = useState('150');
  const [carbsG, setCarbsG] = useState('250');
  const [fatG, setFatG] = useState('65');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError('Please fill in all required profile fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const weight = parseFloat(weightKg);
    if (isNaN(weight) || weight <= 20 || weight > 350) {
      setError('Please enter a valid body weight between 20 and 350 kg.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await register({
        email,
        password,
        full_name: fullName,
        weight_kg: weight,
        base_kcal_goal: parseFloat(baseKcal) || 2200,
        protein_goal_g: parseFloat(proteinG) || 150,
        carbs_goal_g: parseFloat(carbsG) || 250,
        fat_goal_g: parseFloat(fatG) || 65,
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden selection:bg-accent selection:text-on-accent">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(29,78,216,0.05)_0%,transparent_70%)] pointer-events-none" />

      <div
        className="animate-rise w-full max-w-xl space-y-6 relative z-10"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-br from-accent via-success to-info p-[2px] shadow-neu-sm">
            <div className="h-full w-full bg-page rounded-[14px] flex items-center justify-center">
              <Activity className="h-6 w-6 text-accent" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-ink ">
            Create Your Account
          </h1>
          <p className="text-xs text-muted">
            Set up your profile, body weight and daily calorie goal
          </p>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 rounded-3xl bg-card border border-line shadow-2xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="reg-name" className="text-xs font-semibold text-muted flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-accent" /> Full Name
              </label>
              <input id="reg-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Rivera"
                required
                className="w-full bg-well border border-line focus:border-accent rounded-2xl px-3.5 py-2.5 text-xs text-ink placeholder-muted focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-email" className="text-xs font-semibold text-muted flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-accent" /> Email
              </label>
              <input id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="athlete@example.com"
                required
                className="w-full bg-well border border-line focus:border-accent rounded-2xl px-3.5 py-2.5 text-xs text-ink placeholder-muted focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="reg-password" className="text-xs font-semibold text-muted flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-accent" /> Password (min 8 chars)
              </label>
              <input id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-well border border-line focus:border-accent rounded-2xl px-3.5 py-2.5 text-xs text-ink placeholder-muted focus:outline-none tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-confirm" className="text-xs font-semibold text-muted flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-accent" /> Confirm Password
              </label>
              <input id="reg-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-well border border-line focus:border-accent rounded-2xl px-3.5 py-2.5 text-xs text-ink placeholder-muted focus:outline-none tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label htmlFor="reg-weight" className="text-xs font-semibold text-muted flex items-center gap-1">
                <Scale className="h-3.5 w-3.5 text-accent" /> Weight (kg)
              </label>
              <input id="reg-weight"
                type="number"
                step="0.5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
                className="w-full bg-well border border-line focus:border-accent rounded-2xl px-3 py-2 text-xs text-ink tabular-nums focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-kcal" className="text-xs font-semibold text-muted flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-accent" /> Daily Calorie Goal (kcal)
              </label>
              <input id="reg-kcal"
                type="number"
                value={baseKcal}
                onChange={(e) => setBaseKcal(e.target.value)}
                required
                className="w-full bg-well border border-line focus:border-accent rounded-2xl px-3 py-2 text-xs text-ink tabular-nums focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-accent text-on-accent font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-neu-sm hover:bg-accent-hover transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Initializing Profile...' : 'Complete Profile & Launch'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="text-center text-xs text-muted pt-2">
            Already registered?{' '}
            <Link to="/login" className="text-accent font-semibold hover:underline">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
