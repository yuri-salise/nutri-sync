import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
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
    <div className="min-h-screen bg-[#000000] flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden font-poppins selection:bg-[#C8FF00] selection:text-black">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(200,255,0,0.05)_0%,transparent_70%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl space-y-6 relative z-10"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-br from-[#C8FF00] via-[#00D26A] to-[#00E5FF] p-[2px] shadow-glow-lime">
            <div className="h-full w-full bg-[#000000] rounded-[14px] flex items-center justify-center">
              <Activity className="h-6 w-6 text-[#C8FF00]" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white font-poppins">
            Create Athlete Profile
          </h1>
          <p className="text-xs text-[#848E9C]">
            Configure dynamic metabolic baselines and biometrics
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-[#F6465D]/10 border border-[#F6465D]/30 text-[#F6465D] text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 rounded-3xl bg-[#12151b] border border-[#1e232d] shadow-2xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#848E9C] flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[#C8FF00]" /> Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Yuri Salise"
                required
                className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-[#848E9C] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#848E9C] flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-[#C8FF00]" /> Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yuri@athlete.com"
                required
                className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-[#848E9C] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#848E9C] flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[#C8FF00]" /> Password (min 8 chars)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-[#848E9C] focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#848E9C] flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[#C8FF00]" /> Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-[#848E9C] focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#848E9C] flex items-center gap-1">
                <Scale className="h-3.5 w-3.5 text-[#C8FF00]" /> Weight (kg)
              </label>
              <input
                type="number"
                step="0.5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
                className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-2xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#848E9C] flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-[#C8FF00]" /> Base TDEE (kcal)
              </label>
              <input
                type="number"
                value={baseKcal}
                onChange={(e) => setBaseKcal(e.target.value)}
                required
                className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-2xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#848E9C]">Account Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-[#07080a] border border-[#1e232d] rounded-2xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="athlete">Athlete</option>
                <option value="admin">Coach / Admin</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-[#C8FF00] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-glow-lime hover:bg-[#d4ff33] transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Initializing Profile...' : 'Complete Profile & Launch'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="text-center text-xs text-[#848E9C] pt-2">
            Already registered?{' '}
            <Link to="/login" className="text-[#C8FF00] font-semibold hover:underline">
              Sign in to terminal
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
