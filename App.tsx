
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { SessionStatus, TranscriptionItem, Persona, ConversationSession, User } from './types';
import { decode, decodeAudioData, createPcmBlob } from './utils/audio-utils';
import { exportToTxt } from './utils/export-utils';
import Visualizer from './components/Visualizer';
import TranscriptionPanel from './components/TranscriptionPanel';
import AuthModal from './components/AuthModal';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';

const PERSONAS: Persona[] = [
  {
    id: 'sarah',
    name: 'Sarah',
    label: 'Woman',
    description: 'Empathetic, warm, and a great active listener.',
    voice: 'Puck',
    color: 'rose',
    prompt: 'You are Sarah, a warm and empathetic woman in her late 30s. You are an expert active listener.'
  },
  {
    id: 'arthur',
    name: 'Arthur',
    label: 'Man',
    description: 'Professional, articulate, and logically grounded.',
    voice: 'Zephyr',
    color: 'blue',
    prompt: 'You are Arthur, a professional man. You focus on logic and facts.'
  },
  {
    id: 'elias',
    name: 'Elias',
    label: 'Old Man',
    description: 'Wise, slow-paced, and full of storytelling wisdom.',
    voice: 'Fenrir',
    color: 'amber',
    prompt: 'You are Elias, a wise 80-year-old man. You share stories with patience.'
  },
  {
    id: 'martha',
    name: 'Martha',
    label: 'Old Woman',
    description: 'Nurturing, grandmotherly, and very supportive.',
    voice: 'Puck',
    color: 'orange',
    prompt: 'You are Martha, a nurturing grandmother figure.'
  },
  {
    id: 'lily',
    name: 'Lily',
    label: 'Girl',
    description: 'High energy, creative, and endlessly curious.',
    voice: 'Kore',
    color: 'purple',
    prompt: 'You are Lily, a bubbly 12-year-old girl.'
  },
  {
    id: 'leo',
    name: 'Leo',
    label: 'Boy',
    description: 'Adventurous, fast-talking, and energetic.',
    voice: 'Kore',
    color: 'emerald',
    prompt: 'You are Leo, a 10-year-old boy who loves science.'
  }
];

const endConversationTool: FunctionDeclaration = {
  name: 'end_conversation',
  description: 'Ends the session.',
  parameters: { type: Type.OBJECT, properties: {} }
};

const getColorClasses = (color: string) => {
  const map: Record<string, any> = {
    rose: { accent: 'rose-500', bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500', glow: 'bg-rose-600/10', shadow: 'shadow-rose-500/20', ring: 'ring-rose-500/30' },
    blue: { accent: 'blue-500', bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500', glow: 'bg-blue-600/10', shadow: 'shadow-blue-500/20', ring: 'ring-blue-500/30' },
    amber: { accent: 'amber-500', bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500', glow: 'bg-amber-600/10', shadow: 'shadow-amber-500/20', ring: 'ring-amber-500/30' },
    orange: { accent: 'orange-500', bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500', glow: 'bg-orange-600/10', shadow: 'shadow-orange-500/20', ring: 'ring-orange-500/30' },
    purple: { accent: 'purple-500', bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500', glow: 'bg-purple-600/10', shadow: 'shadow-purple-500/20', ring: 'ring-purple-500/30' },
    emerald: { accent: 'emerald-500', bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500', glow: 'bg-emerald-600/10', shadow: 'shadow-emerald-500/20', ring: 'ring-emerald-500/30' }
  };
  return map[color] || map.blue;
};

const App: React.FC = () => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const statusRef = useRef<SessionStatus>(SessionStatus.IDLE);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [currentTone, setCurrentTone] = useState<string>('Calm');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(PERSONAS[0].id);
  const [history, setHistory] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  const selectedPersona = useMemo(() => 
    PERSONAS.find(p => p.id === selectedPersonaId) || PERSONAS[0]
  , [selectedPersonaId]);

  const theme = useMemo(() => getColorClasses(selectedPersona.color), [selectedPersona.color]);

  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const inputChunkRef = useRef<string>('');
  const outputChunkRef = useRef<string>('');

  useEffect(() => {
    const savedUser = localStorage.getItem('echosphere_current_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      loadUserHistory(parsedUser.id);
    }
  }, []);

  const loadUserHistory = (userId: string) => {
    const savedHistory = localStorage.getItem(`echosphere_history_${userId}`);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    else setHistory([]);
  };

  const handleAuth = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('echosphere_current_user', JSON.stringify(newUser));
    loadUserHistory(newUser.id);
  };

  const handleSignOut = () => {
    setUser(null);
    setHistory([]);
    localStorage.removeItem('echosphere_current_user');
    setSidebarOpen(false);
  };

  const saveToHistory = useCallback((items: TranscriptionItem[]) => {
    if (items.length === 0 || !user) return;
    const newSession: ConversationSession = {
      id: activeSessionId || Date.now().toString(),
      userId: user.id,
      personaId: selectedPersonaId,
      timestamp: Date.now(),
      transcriptions: items,
      lastTone: currentTone,
      title: items[0]?.text.slice(0, 30) + '...' || 'Neural Session'
    };
    
    setHistory(prev => {
      const filtered = prev.filter(s => s.id !== newSession.id);
      const updated = [newSession, ...filtered];
      localStorage.setItem(`echosphere_history_${user.id}`, JSON.stringify(updated));
      return updated;
    });
    setActiveSessionId(newSession.id);
  }, [activeSessionId, selectedPersonaId, currentTone, user]);

  const updateStatus = (newStatus: SessionStatus) => {
    setStatus(newStatus);
    statusRef.current = newStatus;
  };

  const stopSession = useCallback((finishedManually: boolean = true) => {
    if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();

    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(s => { try { s.close(); } catch(e) {} });
      sessionPromiseRef.current = null;
    }

    if (finishedManually) {
      saveToHistory(transcriptions);
      updateStatus(SessionStatus.FINISHED);
    } else {
      updateStatus(SessionStatus.IDLE);
    }
    nextStartTimeRef.current = 0;
  }, [transcriptions, saveToHistory]);

  const startSession = useCallback(async (existingSession?: ConversationSession) => {
    if (!user) {
      setAuthMode('signup');
      setShowAuthModal(true);
      return;
    }

    try {
      updateStatus(SessionStatus.CONNECTING);
      
      if (existingSession) {
        setTranscriptions(existingSession.transcriptions);
        setSelectedPersonaId(existingSession.personaId);
        setActiveSessionId(existingSession.id);
      } else {
        setTranscriptions([]);
        setActiveSessionId(Date.now().toString());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      if (!inputAudioCtxRef.current) inputAudioCtxRef.current = new AudioContext({ sampleRate: 16000 });
      if (!outputAudioCtxRef.current) outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
      
      await inputAudioCtxRef.current.resume();
      await outputAudioCtxRef.current.resume();

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const persona = existingSession 
        ? PERSONAS.find(p => p.id === existingSession.personaId)! 
        : selectedPersona;

      const systemInstruction = persona.prompt + (existingSession ? " Note: This is a continuation. Review history." : "");

      sessionPromiseRef.current = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            updateStatus(SessionStatus.CONNECTED);
            const source = inputAudioCtxRef.current!.createMediaStreamSource(stream);
            const analyzer = inputAudioCtxRef.current!.createAnalyser();
            analyzer.fftSize = 256;
            analyzerRef.current = analyzer;
            const scriptProcessor = inputAudioCtxRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: createPcmBlob(inputData) });
              });
            };

            source.connect(analyzer);
            analyzer.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtxRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall?.functionCalls.some(fc => fc.name === 'end_conversation')) {
              stopSession(true); return;
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioCtxRef.current!, 24000, 1);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioCtxRef.current!.currentTime);
              const source = outputAudioCtxRef.current!.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAudioCtxRef.current!.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.inputTranscription) inputChunkRef.current += message.serverContent.inputTranscription.text;
            if (message.serverContent?.outputTranscription) outputChunkRef.current += message.serverContent.outputTranscription.text;

            if (message.serverContent?.turnComplete) {
              setTranscriptions(prev => {
                const next = [...prev];
                if (inputChunkRef.current.trim()) next.push({ id: Date.now()+'-u', text: inputChunkRef.current, role: 'user', timestamp: Date.now() });
                if (outputChunkRef.current.trim()) next.push({ id: Date.now()+'-m', text: outputChunkRef.current, role: 'model', timestamp: Date.now() });
                return next;
              });
              inputChunkRef.current = '';
              outputChunkRef.current = '';
            }
          },
          onerror: (e) => { 
            console.error('Session error:', e); 
            if (statusRef.current === SessionStatus.CONNECTED) {
              startSession(); 
            } else {
              updateStatus(SessionStatus.ERROR);
            }
          },
          onclose: () => { if (statusRef.current !== SessionStatus.FINISHED) updateStatus(SessionStatus.IDLE); }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          tools: [{ functionDeclarations: [endConversationTool] }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.voice } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        }
      });
    } catch (err) {
      console.error(err);
      updateStatus(SessionStatus.ERROR);
    }
  }, [stopSession, selectedPersona, user]);

  const handlePersonaClick = (id: string) => {
    if (selectedPersonaId === id) {
      startSession();
    } else {
      setSelectedPersonaId(id);
    }
  };

  const resumeSession = (session: ConversationSession) => {
    setSidebarOpen(false);
    startSession(session);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    setHistory(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem(`echosphere_history_${user.id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const openAuth = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 font-sans overflow-hidden transition-colors duration-1000">
      
      {/* Dynamic Background Decoration */}
      <div className={`fixed top-[-10%] left-[-10%] w-[50%] h-[50%] ${theme.glow} rounded-full blur-[120px] pointer-events-none transition-all duration-1000`}></div>
      <div className={`fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] ${theme.glow} rounded-full blur-[120px] pointer-events-none transition-all duration-1000`}></div>

      {/* Sidebar - History */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-white/10 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex-shrink-0 shadow-2xl`}>
        <div className="p-6 h-full flex flex-col">
          {user ? (
            <div className="mb-8 p-4 rounded-3xl bg-white/5 border border-white/10 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-2xl ${theme.bg} flex items-center justify-center font-black text-white text-xl shadow-inner`}>
                  {user.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black truncate text-white">{user.username}</div>
                  <div className="text-[10px] text-slate-500 truncate font-bold uppercase tracking-wider">{user.id.slice(0,8)}</div>
                </div>
                <button onClick={handleSignOut} className="text-slate-500 hover:text-red-400 p-2 rounded-xl hover:bg-white/5 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-8 space-y-2">
              <button 
                onClick={() => openAuth('signin')}
                className="w-full p-4 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 font-black flex items-center justify-center space-x-2 hover:bg-indigo-600/20 transition-all text-xs"
              >
                <span>SIGN IN</span>
              </button>
              <button 
                onClick={() => openAuth('signup')}
                className="w-full p-4 rounded-2xl bg-white text-slate-950 font-black flex items-center justify-center space-x-2 hover:bg-slate-200 transition-all text-xs"
              >
                <span>CREATE ACCOUNT</span>
              </button>
            </div>
          )}

          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-6 flex items-center space-x-2 px-2">
            <svg className={`w-4 h-4 ${theme.text} transition-colors duration-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Archives</span>
          </h2>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {history.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="text-slate-700 mb-2">
                  <svg className="w-12 h-12 mx-auto opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <p className="text-slate-600 text-xs italic">Neural history is empty.</p>
              </div>
            ) : (
              history.map(session => {
                const sessionPersona = PERSONAS.find(p => p.id === session.personaId);
                const sessionTheme = getColorClasses(sessionPersona?.color || 'blue');
                return (
                  <div 
                    key={session.id}
                    onClick={() => resumeSession(session)}
                    className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer group transition-all relative overflow-hidden"
                  >
                    <div className={`text-[10px] font-black uppercase tracking-widest ${sessionTheme.text} mb-1`}>{sessionPersona?.name || 'Unknown'}</div>
                    <div className="text-sm font-bold truncate pr-12 text-slate-200">{session.title}</div>
                    <div className="text-[10px] text-slate-500 mt-2 font-medium">{new Date(session.timestamp).toLocaleDateString()}</div>
                    
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); exportToTxt(session); }}
                        className="text-slate-500 hover:text-white p-2 rounded-lg hover:bg-white/5"
                        title="Export transcript"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                      <button 
                        onClick={(e) => deleteSession(session.id, e)}
                        className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-400/10"
                        title="Purge record"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <button 
            onClick={() => { setTranscriptions([]); updateStatus(SessionStatus.IDLE); setSidebarOpen(false); }}
            className={`mt-6 w-full py-4 ${theme.glow} hover:brightness-125 ${theme.text} font-black rounded-2xl border border-white/5 transition-all text-[10px] uppercase tracking-[0.2em] shadow-lg`}
          >
            Terminal Reset
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className="p-6 flex items-center justify-between relative z-40 bg-slate-950/50 backdrop-blur-md border-b border-white/5 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 text-slate-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 ${theme.bg} rounded-xl flex items-center justify-center shadow-xl transition-colors duration-1000 rotate-3`}><svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></div>
              <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tighter">EchoSphere</h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {!user && (
               <button 
                 onClick={() => openAuth('signup')}
                 className="hidden sm:block text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-white/10 rounded-full hover:bg-white/5 transition-all"
               >
                 Register
               </button>
            )}
            <div className={`hidden sm:flex items-center px-4 py-1.5 rounded-full bg-white/5 border ${theme.border} text-[10px] font-black tracking-[0.2em] ${theme.text} uppercase transition-all duration-1000 shadow-inner`}>
              {status}
            </div>
            {status === SessionStatus.CONNECTED && (
               <button onClick={() => stopSession(true)} className="px-6 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-500/30 rounded-full text-[10px] font-black tracking-widest transition-all shadow-xl shadow-red-950/20">
                 DISCONNECT
               </button>
            )}
          </div>
        </header>

        <main className="flex-1 relative overflow-hidden z-10">
          {status !== SessionStatus.CONNECTED ? (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                <div className="max-w-5xl mx-auto space-y-16 pb-40">
                  <div className="text-center space-y-6 pt-8">
                    <h2 className="text-5xl sm:text-7xl font-black text-white tracking-tighter leading-none">Choose Your <span className={`text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-600`}>Vocal Bridge</span></h2>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">Select a specialized persona to begin your real-time emotional journey. Registration ensures your neural logs are preserved.</p>
                    
                    {!user && (
                      <div className="flex items-center justify-center space-x-4 pt-4">
                        <button 
                          onClick={() => openAuth('signup')}
                          className="px-8 py-4 bg-white text-slate-950 font-black rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all"
                        >
                          REGISTER TO SAVE
                        </button>
                        <button 
                          onClick={() => openAuth('signin')}
                          className="px-8 py-4 bg-white/5 border border-white/10 text-white font-black rounded-2xl shadow-xl hover:bg-white/10 transition-all"
                        >
                          SIGN IN
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {PERSONAS.map(p => {
                      const pTheme = getColorClasses(p.color);
                      const isSelected = selectedPersonaId === p.id;
                      return (
                        <div 
                          key={p.id}
                          onClick={() => handlePersonaClick(p.id)}
                          className={`relative p-8 rounded-[2.5rem] cursor-pointer transition-all duration-500 border-2 overflow-hidden group ${isSelected ? `${pTheme.border} ${pTheme.glow} shadow-2xl ${pTheme.shadow} scale-[1.02]` : 'border-white/5 bg-white/5 hover:border-white/20 hover:translate-y-[-4px]'}`}
                        >
                          <div className="relative z-10 space-y-4">
                            <div className="flex items-center justify-between">
                              <span className={`px-3 py-1 rounded-full bg-white/10 text-[9px] font-black uppercase tracking-widest ${isSelected ? pTheme.text : 'text-slate-400'} transition-colors duration-500`}>{p.label}</span>
                              {isSelected && (
                                <div className={`p-1.5 ${pTheme.bg} rounded-full animate-bounce shadow-lg shadow-black/20`}>
                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                </div>
                              )}
                            </div>
                            <h3 className="text-3xl font-black text-white group-hover:translate-x-1 transition-transform duration-300">{p.name}</h3>
                            <p className="text-sm text-slate-400 leading-relaxed line-clamp-3 font-medium">{p.description}</p>
                            
                            <div className={`pt-4 flex items-center space-x-2 text-[9px] font-black uppercase tracking-widest ${isSelected ? pTheme.text : 'text-slate-600'}`}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                              <span>Neural Voice: {p.voice}</span>
                            </div>
                          </div>
                          <div className={`absolute bottom-[-20px] right-[-20px] w-28 h-28 ${isSelected ? pTheme.bg : 'bg-white/5'} rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-all duration-500`}></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sticky Footer for Begin Journey */}
              <div className="absolute bottom-0 inset-x-0 p-8 pb-12 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent z-50 flex flex-col items-center">
                <button 
                  onClick={() => startSession()}
                  disabled={status === SessionStatus.CONNECTING}
                  className={`px-16 py-6 bg-white text-slate-950 font-black text-2xl rounded-[2rem] hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_rgba(255,255,255,0.15)] ${theme.shadow} flex items-center space-x-6 group ring-[10px] ${theme.ring} ${status === SessionStatus.CONNECTING ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="uppercase tracking-tighter">{status === SessionStatus.CONNECTING ? 'Connecting...' : 'Initiate Session'}</span>
                  {status !== SessionStatus.CONNECTING && (
                    <svg className="w-8 h-8 group-hover:translate-x-2 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  )}
                </button>
                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">Neural link stability: 99.8%</p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col p-4 sm:p-8 space-y-6">
              <div className="flex flex-col items-center justify-center py-10 bg-white/5 backdrop-blur-xl rounded-[3rem] border border-white/10 shadow-inner flex-shrink-0 transition-all duration-1000 relative overflow-hidden">
                <div className={`absolute inset-0 ${theme.glow} opacity-5 blur-[100px] pointer-events-none`}></div>
                
                {status === SessionStatus.CONNECTED && (
                  <div className={`flex items-center space-x-3 ${theme.text} text-[10px] font-black uppercase tracking-[0.3em] mb-6 bg-white/5 px-6 py-2 rounded-full border border-white/10 animate-pulse shadow-xl`}>
                    <span className={`w-2 h-2 ${theme.bg} rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]`}></span>
                    <span>Direct Neural Path Active</span>
                  </div>
                )}
                
                <div className={`text-xs font-black ${theme.text} uppercase tracking-widest mb-2 transition-colors duration-1000 flex items-center space-x-2`}>
                   <span className="w-1.5 h-1.5 bg-slate-500 rounded-full opacity-50"></span>
                   <span>Persona: {selectedPersona.name}</span>
                </div>
                
                <div className="text-4xl sm:text-5xl font-black text-white mb-6 tracking-tighter">
                  {currentTone} Resonance
                </div>
                
                <Visualizer 
                  isActive={status === SessionStatus.CONNECTED} 
                  analyzer={analyzerRef.current || undefined} 
                  color={selectedPersona.color}
                />
              </div>
              
              <TranscriptionPanel 
                items={transcriptions} 
                personaColor={selectedPersona.color}
                activeSessionId={activeSessionId}
                userId={user?.id}
                onClear={() => setTranscriptions([])}
              />
            </div>
          )}
        </main>
      </div>

      {showAuthModal && (
        <AuthModal 
          theme={theme} 
          onAuth={handleAuth} 
          onClose={() => setShowAuthModal(false)} 
          initialMode={authMode}
        />
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>
    </div>
  );
};

export default App;
