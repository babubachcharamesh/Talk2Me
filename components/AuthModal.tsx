
import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface AuthModalProps {
  onAuth: (user: User) => void;
  onClose: () => void;
  theme: any;
  initialMode?: 'signin' | 'signup';
}

const AuthModal: React.FC<AuthModalProps> = ({ onAuth, onClose, theme, initialMode = 'signin' }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setError(null);
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Simulate network delay for a more realistic feel
    await new Promise(resolve => setTimeout(resolve, 800));

    const storedUsers = JSON.parse(localStorage.getItem('echosphere_users') || '[]');

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setIsSubmitting(false);
        return;
      }

      const emailExists = storedUsers.some((u: any) => u.email === email);
      if (emailExists) {
        setError('An account with this email already exists.');
        setIsSubmitting(false);
        return;
      }

      const userId = Math.random().toString(36).substr(2, 9);
      const newUser: User = { id: userId, username, email };
      
      storedUsers.push({ ...newUser, password });
      localStorage.setItem('echosphere_users', JSON.stringify(storedUsers));
      
      onAuth(newUser);
      onClose();
    } else {
      const existingUser = storedUsers.find((u: any) => u.email === email && u.password === password);
      
      if (existingUser) {
        onAuth({ 
          id: existingUser.id, 
          username: existingUser.username, 
          email: existingUser.email 
        });
        onClose();
      } else {
        setError('Invalid credentials. Please check your email and password.');
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className={`w-full max-w-md bg-slate-900 border ${theme.border} rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden transition-all duration-500`}>
        {/* Decorative background gradients */}
        <div className={`absolute top-0 right-0 w-48 h-48 ${theme.glow} rounded-full blur-[80px] opacity-30 -translate-y-1/2 translate-x-1/2`}></div>
        <div className={`absolute bottom-0 left-0 w-32 h-32 ${theme.glow} rounded-full blur-[60px] opacity-20 translate-y-1/2 -translate-x-1/2`}></div>
        
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors z-20">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-1 text-white text-center">
            {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-slate-400 mb-8 text-center text-sm font-medium">
            {mode === 'signup' ? 'Bridge the gap between human and machine.' : 'Access your private neural archives.'}
          </p>

          {/* Tab Switcher */}
          <div className="flex p-1 bg-white/5 rounded-2xl mb-8">
            <button 
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'signin' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'signup' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold animate-in slide-in-from-top-2">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Username</label>
                <input 
                  required
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                  placeholder="Pilot Name"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Email Address</label>
              <input 
                required
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                placeholder="email@provider.com"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Password</label>
              <input 
                required
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                placeholder="••••••••"
              />
            </div>
            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Confirm Password</label>
                <input 
                  required
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                  placeholder="••••••••"
                />
              </div>
            )}

            <button 
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 mt-4 ${theme.bg} text-white font-black rounded-2xl shadow-xl shadow-black/40 transition-all hover:brightness-110 active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-50`}
            >
              {isSubmitting ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <span>{mode === 'signup' ? 'ESTABLISH LINK' : 'ACCESS SPHERE'}</span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5">
            <p className="text-center text-slate-500 text-xs font-medium">
              By connecting, you agree to the EchoSphere Neural Protocols.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
