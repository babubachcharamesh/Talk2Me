
import React, { useEffect, useRef, useState } from 'react';
import { TranscriptionItem, ConversationSession, User, Emotion } from '../types';
import { exportToTxt, exportToJson, exportToPdf } from '../utils/export-utils';
import Avatar from './Avatar';

interface TranscriptionPanelProps {
  items: TranscriptionItem[];
  onClear?: () => void;
  personaColor?: string;
  activeSessionId?: string | null;
  userId?: string | null;
  user?: User | null;
  lastSaved?: number | null;
  isSessionActive?: boolean;
}

const getColorClasses = (color: string = 'blue') => {
  const map: Record<string, any> = {
    rose: { bg: 'bg-rose-600', text: 'text-rose-400', shadow: 'shadow-rose-600/20' },
    blue: { bg: 'bg-blue-600', text: 'text-blue-400', shadow: 'shadow-blue-600/20' },
    amber: { bg: 'bg-amber-600', text: 'text-amber-400', shadow: 'shadow-amber-600/20' },
    orange: { bg: 'bg-orange-600', text: 'text-orange-400', shadow: 'shadow-orange-600/20' },
    purple: { bg: 'bg-purple-600', text: 'text-purple-400', shadow: 'shadow-purple-600/20' },
    emerald: { bg: 'bg-emerald-600', text: 'text-emerald-400', shadow: 'shadow-emerald-600/20' }
  };
  return map[color] || map.blue;
};

const MOOD_MAP: Record<Emotion, { icon: string; label: string; color: string; bg: string }> = {
  NEUTRAL: { icon: '🧠', label: 'Neutral', color: 'text-slate-400', bg: 'bg-slate-500/10' },
  HAPPY: { icon: '✨', label: 'Happy', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  EXCITED: { icon: '⚡', label: 'Excited', color: 'text-pink-400', bg: 'bg-pink-500/10' },
  SAD: { icon: '🌊', label: 'Melancholic', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  CONCERNED: { icon: '🛡️', label: 'Concerned', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  ANGRY: { icon: '🔥', label: 'Intense', color: 'text-red-400', bg: 'bg-red-500/10' },
  THOUGHTFUL: { icon: '🌌', label: 'Thoughtful', color: 'text-teal-400', bg: 'bg-teal-500/10' },
  CURIOUS: { icon: '🔍', label: 'Curious', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  EMPATHETIC: { icon: '💖', label: 'Empathetic', color: 'text-orange-400', bg: 'bg-orange-500/10' }
};

const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({ 
  items, 
  onClear, 
  personaColor, 
  activeSessionId, 
  userId,
  user,
  lastSaved,
  isSessionActive
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const theme = getColorClasses(personaColor);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  const handleExport = (type: 'txt' | 'json' | 'pdf') => {
    const dummySession: ConversationSession = {
      id: activeSessionId || 'current',
      userId: user?.username || userId || 'guest',
      personaId: personaColor || 'unknown',
      timestamp: Date.now(),
      transcriptions: items,
      lastTone: 'Neutral',
      title: 'Current Conversation'
    };
    if (type === 'txt') exportToTxt(dummySession);
    else if (type === 'json') exportToJson(dummySession);
    else if (type === 'pdf') exportToPdf(dummySession);
    setShowExportMenu(false);
  };

  const formatLastSaved = (timestamp: number | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `Synced: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto overflow-hidden flex flex-col glass rounded-3xl transition-all duration-500 border border-white/10 relative">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md z-20">
        <div className="flex items-center space-x-2">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Live Dialogue</h3>
          <span className={`flex h-1.5 w-1.5 rounded-full ${theme.bg} animate-pulse transition-colors duration-500`}></span>
          
          {lastSaved && (
            <div className="flex items-center space-x-1.5 ml-4 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 group relative cursor-help">
              <span className={`w-1 h-1 rounded-full ${isSessionActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></span>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">
                {formatLastSaved(lastSaved)}
              </span>
              <div className="absolute left-0 top-full mt-1 px-2 py-1 bg-slate-900 border border-white/10 rounded-md text-[8px] text-slate-400 invisible group-hover:visible whitespace-nowrap z-50">
                Auto-syncing neural data every 30s
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {items.length > 0 && (
            <div className="relative">
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="text-[10px] text-slate-400 hover:text-white font-bold uppercase tracking-widest transition-colors px-3 py-1.5 rounded-full bg-white/5 border border-white/10 flex items-center space-x-2"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span>Export</span>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 w-40 glass rounded-xl overflow-hidden border border-white/10 shadow-2xl z-50 animate-in slide-in-from-top-2">
                  <button onClick={() => handleExport('pdf')} className="w-full px-4 py-2 text-left text-xs text-slate-300 hover:bg-white/10 transition-colors flex items-center space-x-2">
                    <svg className="w-3 h-3 text-rose-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>
                    <span>PDF Document</span>
                  </button>
                  <button onClick={() => handleExport('txt')} className="w-full px-4 py-2 text-left text-xs text-slate-300 hover:bg-white/10 transition-colors border-t border-white/5 flex items-center space-x-2">
                    <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>
                    <span>Plain Text</span>
                  </button>
                  <button onClick={() => handleExport('json')} className="w-full px-4 py-2 text-left text-xs text-slate-300 hover:bg-white/10 transition-colors border-t border-white/5 flex items-center space-x-2">
                    <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>
                    <span>JSON Data</span>
                  </button>
                </div>
              )}
            </div>
          )}
          {items.length > 0 && onClear && (
            <button 
              onClick={onClear}
              className="text-[10px] text-slate-500 hover:text-red-400 font-bold uppercase tracking-widest transition-colors px-2 py-1 rounded-md hover:bg-red-400/10"
            >
              Purge
            </button>
          )}
        </div>
      </div>

      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth custom-scrollbar relative"
      >
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 italic space-y-4 opacity-50">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm font-medium tracking-wide text-center">Neural pathways open.<br/>Initiate vocal transmission.</p>
          </div>
        ) : (
          items.map((item) => (
            <div 
              key={item.id} 
              className={`flex items-start space-x-3 ${item.role === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div className="flex-shrink-0 mt-1">
                {item.role === 'user' ? (
                  <Avatar user={user} size="xs" />
                ) : (
                  <div className={`w-6 h-6 rounded-full ${theme.bg} flex items-center justify-center text-[10px] font-black text-white shadow-md border border-white/10 transition-colors duration-500`}>
                    {initialsFromName(personaColor || 'AI')}
                  </div>
                )}
              </div>
              <div className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
                {item.role === 'model' && item.mood && (
                  <div className={`flex items-center space-x-1.5 mb-1 px-2 py-0.5 rounded-full border border-white/5 ${MOOD_MAP[item.mood].bg} animate-in zoom-in duration-500`}>
                    <span className="text-[10px]">{MOOD_MAP[item.mood].icon}</span>
                    <span className={`text-[8px] font-black uppercase tracking-widest ${MOOD_MAP[item.mood].color}`}>
                      {MOOD_MAP[item.mood].label}
                    </span>
                  </div>
                )}
                <div 
                  className={`px-5 py-3 rounded-2xl text-sm leading-relaxed transition-all duration-500 ${
                    item.role === 'user' 
                      ? `${theme.bg} text-white rounded-tr-none shadow-lg ${theme.shadow}` 
                      : 'bg-slate-800/80 text-slate-100 rounded-tl-none border border-white/5 shadow-xl backdrop-blur-sm'
                  }`}
                >
                  {item.text}
                </div>
                <span className="text-[8px] font-black text-slate-500 mt-1 uppercase tracking-widest px-1">
                  {item.role === 'user' ? (user?.username || 'GUEST') : 'MODEL RESPONSE'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
          background: rgba(255,255,255,0.05); 
          border-radius: 10px; 
          border: 1px solid rgba(255,255,255,0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>
    </div>
  );
};

// Helper for initial rendering in the panel
function initialsFromName(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

export default TranscriptionPanel;
