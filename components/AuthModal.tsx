
import React, { useState } from 'react';
import { User } from '../types';

interface AuthModalProps {
  onAuth: (user: User) => void;
  onClose: () => void;
  theme: any;
}

const AuthModal: React.FC<AuthModalProps> = ({ onAuth, onClose, theme }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulation: In a real app, this would call an API
    const userId = Math.random().toString(36).substr(2, 9);
    const user: User = { id: userId, username, email };
    
    // Store user in local storage to simulate "account"
    const users = JSON.parse(localStorage.getItem('echosphere_users') || '[]');
    if (isSignUp) {
      users.push({ ...user, password });
      localStorage.setItem('echosphere_users', JSON.stringify(users));
    }
    
    onAuth(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={`w-full max-w-md glass rounded-3xl p-8 border ${theme.border} shadow-2xl relative overflow-hidden`}>
        <div className={`absolute top-0 right-0 w-32 h-32 ${theme.glow} rounded-full blur-3xl opacity-20`}></div>
        
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h2 className="text-3xl font-black mb-2 text-white">{isSignUp ? 'Join EchoSphere' : 'Welcome Back'}</h2>
        <p className="text-slate-400 mb-8">{isSignUp ? 'Create your profile to save conversations.' : 'Sign in to access your neural archives.'}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Username</label>
              <input 
                required
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="NeuralPilot_42"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Email</label>
            <input 
              required
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
              placeholder="pilot@echosphere.ai"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Password</label>
            <input 
              required
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            className={`w-full py-4 mt-4 ${theme.bg} text-white font-black rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95`}
          >
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="mt-8 text-center text-slate-500 text-sm">
          {isSignUp ? 'Already have an account?' : 'New to the sphere?'}
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className={`ml-2 font-bold ${theme.text} hover:underline`}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
