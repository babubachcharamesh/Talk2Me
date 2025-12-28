
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

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 font-sans overflow-hidden transition-colors duration-1000">
      
      {/* Dynamic Background Decoration */}
      <div className={`fixed top-[-10%] left-[-10%] w-[50%] h-[50%] ${theme.glow} rounded-full blur-[120px] pointer-events-none transition-all duration-1000`}></div>
      <div className={`fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] ${theme.glow} rounded-full blur-[120px] pointer-events-none transition-all duration-1000`}></div>

      {/* Sidebar - History */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-white/10 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex-shrink-0 shadow-2xl`}>
        <div className="p-6 h-full flex flex-col">
          {user ? (
            <div className="mb-8 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full ${theme.bg} flex items-center justify-center font-black text-white`}>
                  {user.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black truncate">{user.username}</div>
                  <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
                </div>
                <button onClick={handleSignOut} className="text-slate-500 hover:text-red-400 p-1 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="mb-8 w-full p-4 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 font-black flex items-center justify-center space-x-2 hover:bg-indigo-600/20 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <span>Sign In</span>
            </button>
          )}

          <h2 className="text-xl font-bold mb-6 flex items-center space-x-2">
            <svg className={`w-5 h-5 ${theme.text} transition-colors duration-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Archives</span>
          </h2>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {history.length === 0 ? (
              <p className="text-slate-500 text-sm italic p-4 text-center">No neural logs found.</p>
            ) : (
              history.map(session => {
                const sessionPersona = PERSONAS.find(p => p.id === session.personaId);
                const sessionTheme = getColorClasses(sessionPersona?.color || 'blue');
                return (
                  <div 
                    key={session.id}
                    onClick={() => resumeSession(session)}
                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer group transition-all relative overflow-hidden"
                  >
                    <div className={`text-xs font-bold ${sessionTheme.text} mb-1`}>{sessionPersona?.name || 'Unknown'}</div>
                    <div className="text-sm font-medium truncate pr-12">{session.title}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{new Date(session.timestamp).toLocaleDateString()}</div>
                    
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); exportToTxt(session); }}
                        className="text-slate-500 hover:text-white p-1"
                        title="Download transcript"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                      <button 
                        onClick={(e) => deleteSession(session.id, e)}
                        className="text-slate-500 hover:text-red-400 p-1"
                        title="Delete log"
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
            className={`mt-6 w-full py-3 ${theme.glow} hover:brightness-125 ${theme.text} font-bold rounded-xl border border-white/10 transition-all text-sm`}
          >
            Reset Session
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
              <div className={`w-8 h-8 ${theme.bg} rounded-lg flex items-center justify-center shadow-lg transition-colors duration-1000`}><svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">EchoSphere</h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`hidden sm:flex items-center px-3 py-1 rounded-full bg-white/5 border ${theme.border} text-[10px] font-bold tracking-widest ${theme.text} uppercase transition-all duration-1000`}>
              {status}
            </div>
            {status === SessionStatus.CONNECTED && (
               <button onClick={() => stopSession(true)} className="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded-full text-xs font-bold transition-all shadow-lg shadow-red-500/10">
                 DISCONNECT
               </button>
            )}
          </div>
        </header>

        <main className="flex-1 relative overflow-hidden z-10">
          {status !== SessionStatus.CONNECTED ? (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-12 pb-32">
                  <div className="text-center space-y-4">
                    <h2 className="text-4xl sm:text-5xl font-black text-white">Select Your Echo</h2>
                    <p className="text-slate-400 text-lg">Choose a persona to bridge the gap. Vocal link requires authorization.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {PERSONAS.map(p => {
                      const pTheme = getColorClasses(p.color);
                      const isSelected = selectedPersonaId === p.id;
                      return (
                        <div 
                          key={p.id}
                          onClick={() => handlePersonaClick(p.id)}
                          className={`relative p-6 rounded-3xl cursor-pointer transition-all duration-500 border-2 overflow-hidden group ${isSelected ? `${pTheme.border} ${pTheme.glow} shadow-2xl ${pTheme.shadow}` : 'border-white/5 bg-white/5 hover:border-white/20'}`}
                        >
                          <div className="relative z-10 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-black uppercase ${isSelected ? pTheme.text : 'text-slate-400'} transition-colors duration-500`}>{p.label}</span>
                              {isSelected && (
                                <div className={`p-1 ${pTheme.bg} rounded-full animate-bounce shadow-lg shadow-black/20`}>
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                </div>
                              )}
                            </div>
                            <h3 className="text-2xl font-bold text-white group-hover:translate-x-1 transition-transform duration-300">{p.name}</h3>
                            <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">{p.description}</p>
                          </div>
                          <div className={`absolute bottom-[-10px] right-[-10px] w-20 h-20 ${isSelected ? pTheme.bg : 'bg-white/5'} rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-all duration-500`}></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sticky Footer for Begin Journey */}
              <div className="absolute bottom-0 inset-x-0 p-8 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent z-50 flex justify-center">
                <button 
                  onClick={() => startSession()}
                  disabled={status === SessionStatus.CONNECTING}
                  className={`px-12 py-5 bg-white text-slate-950 font-black text-xl rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl ${theme.shadow} flex items-center space-x-4 group ring-4 ${theme.ring} ${status === SessionStatus.CONNECTING ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="uppercase tracking-tight">{status === SessionStatus.CONNECTING ? 'Connecting...' : 'Begin Journey'}</span>
                  {status !== SessionStatus.CONNECTING && (
                    <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col p-4 sm:p-8 space-y-6">
              <div className="flex flex-col items-center justify-center py-8 bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 shadow-inner flex-shrink-0 transition-all duration-1000">
                {status === SessionStatus.CONNECTED && (
                  <div className={`flex items-center space-x-2 ${theme.text} text-[10px] font-black uppercase tracking-[0.2em] mb-4 bg-white/5 px-4 py-1 rounded-full border border-white/10 animate-pulse`}>
                    <span className={`w-1.5 h-1.5 ${theme.bg} rounded-full`}></span>
                    <span>Neural Link Active</span>
                  </div>
                )}
                <div className={`text-xs font-bold ${theme.text} uppercase tracking-tighter mb-1 transition-colors duration-1000`}>Identity: {selectedPersona.name}</div>
                <div className="text-3xl font-black text-white">{currentTone} Vibe</div>
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
        />
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};

export default App;
