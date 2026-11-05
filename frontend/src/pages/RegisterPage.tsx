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
  const [role, setRole] = useState<'athlete' | 'admin'>('athlete');
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
        role,
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
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 p-0.5 shadow-glow-emerald">
            <div className="h-full w-full bg-[#0a0d14] rounded-[14px] flex items-center justify-center">
              <Activity className="h-6 w-6 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Create Your Athlete Profile</h1>
          <p className="text-sm text-athletic-muted">
            Configure dynamic TDEE baseline and activity synchronization
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-athletic-card border border-athletic-border space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-athletic-muted" /> Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Yuri Salise"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-athletic-border text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-athletic-muted" /> Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yuri@athlete.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-athletic-border text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
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
                placeholder="Min 8 characters"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-athletic-border text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-athletic-muted" /> Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type password"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-athletic-border text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-athletic-border">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                Role (Requirement B4)
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-athletic-border text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="athlete">Athlete / Member</option>
                <option value="admin">Coach / Administrator</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-cyan-400" /> Body Weight (kg)
              </label>
              <input
                type="number"
                step="0.5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-athletic-border text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Daily Base Goals */}
          <div className="space-y-2 pt-2 border-t border-athletic-border">
            <p className="text-xs font-semibold text-athletic-muted flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-amber-400" /> Base Daily Caloric & Macronutrient Targets
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="space-y-1">
                <span className="text-[11px] text-athletic-muted">Base Calories</span>
                <input
                  type="number"
                  value={baseKcal}
                  onChange={(e) => setBaseKcal(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-900/90 border border-athletic-border text-slate-100 text-xs text-center"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-emerald-400 font-medium">Protein (g)</span>
                <input
                  type="number"
                  value={proteinG}
                  onChange={(e) => setProteinG(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-900/90 border border-athletic-border text-slate-100 text-xs text-center"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-cyan-400 font-medium">Carbs (g)</span>
                <input
                  type="number"
                  value={carbsG}
                  onChange={(e) => setCarbsG(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-900/90 border border-athletic-border text-slate-100 text-xs text-center"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-amber-400 font-medium">Fat (g)</span>
                <input
                  type="number"
                  value={fatG}
                  onChange={(e) => setFatG(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-900/90 border border-athletic-border text-slate-100 text-xs text-center"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-95 shadow-glow-emerald transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-athletic-muted">
          Already registered?{' '}
          <Link to="/login" className="text-emerald-400 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
