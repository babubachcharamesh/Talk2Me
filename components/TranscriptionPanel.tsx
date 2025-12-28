
import React, { useEffect, useRef, useState } from 'react';
import { TranscriptionItem, ConversationSession } from '../types';
import { exportToTxt, exportToJson } from '../utils/export-utils';

interface TranscriptionPanelProps {
  items: TranscriptionItem[];
  onClear?: () => void;
  personaColor?: string;
  activeSessionId?: string | null;
  userId?: string | null;
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

const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({ items, onClear, personaColor, activeSessionId, userId }) => {
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

  const handleExport = (type: 'txt' | 'json') => {
    const dummySession: ConversationSession = {
      id: activeSessionId || 'current',
      userId: userId || 'guest',
      personaId: personaColor || 'unknown',
      timestamp: Date.now(),
      transcriptions: items,
      lastTone: 'Neutral',
      title: 'Current Conversation'
    };
    if (type === 'txt') exportToTxt(dummySession);
    else exportToJson(dummySession);
    setShowExportMenu(false);
  };

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto overflow-hidden flex flex-col glass rounded-3xl transition-all duration-500 border border-white/10 relative">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md z-20">
        <div className="flex items-center space-x-2">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Live Dialogue</h3>
          <span className={`flex h-1.5 w-1.5 rounded-full ${theme.bg} animate-pulse transition-colors duration-500`}></span>
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
                <div className="absolute right-0 top-full mt-2 w-32 glass rounded-xl overflow-hidden border border-white/10 shadow-2xl z-50 animate-in slide-in-from-top-2">
                  <button onClick={() => handleExport('txt')} className="w-full px-4 py-2 text-left text-xs text-slate-300 hover:bg-white/10 transition-colors">TXT File</button>
                  <button onClick={() => handleExport('json')} className="w-full px-4 py-2 text-left text-xs text-slate-300 hover:bg-white/10 transition-colors border-t border-white/5">JSON Data</button>
                </div>
              )}
            </div>
          )}
          {items.length > 0 && onClear && (
            <button 
              onClick={onClear}
              className="text-[10px] text-slate-500 hover:text-red-400 font-bold uppercase tracking-widest transition-colors px-2 py-1 rounded-md hover:bg-red-400/10"
            >
              Clear
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
              className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div 
                className={`max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed transition-all duration-500 ${
                  item.role === 'user' 
                    ? `${theme.bg} text-white rounded-br-none shadow-lg ${theme.shadow}` 
                    : 'bg-slate-800/80 text-slate-100 rounded-bl-none border border-white/5 shadow-xl backdrop-blur-sm'
                }`}
              >
                {item.text}
              </div>
              <span className="text-[9px] font-black text-slate-500 mt-2 uppercase tracking-widest px-1">
                {item.role === 'user' ? 'USER INPUT' : 'MODEL RESPONSE'}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Floating Scroll to Bottom Button */}
      <button
        onClick={scrollToBottom}
        className={`absolute bottom-8 right-8 p-3 rounded-full ${theme.bg} text-white shadow-2xl transition-all duration-300 transform z-30 ${
          showScrollButton ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-50 pointer-events-none'
        } hover:brightness-110 hover:scale-110 active:scale-95 flex items-center justify-center`}
        title="Scroll to bottom"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
        </svg>
      </button>

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

export default TranscriptionPanel;
