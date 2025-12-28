
import React from 'react';
import { User } from '../types';

interface AvatarProps {
  user?: User | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ user, size = 'md', className = '' }) => {
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-lg',
  };

  const colors = [
    'bg-indigo-600',
    'bg-emerald-600',
    'bg-rose-600',
    'bg-amber-600',
    'bg-purple-600',
    'bg-blue-600',
    'bg-orange-600',
  ];

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  if (!user) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-slate-800 flex items-center justify-center text-slate-500 border border-white/10 ${className}`}>
        <svg className="w-1/2 h-1/2" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      </div>
    );
  }

  const initials = getInitials(user.username);
  const bgColor = getAvatarColor(user.username);

  return (
    <div className={`${sizeClasses[size]} rounded-full ${bgColor} flex items-center justify-center font-black text-white shadow-lg border border-white/10 ring-1 ring-white/5 ${className}`}>
      {initials}
    </div>
  );
};

export default Avatar;
