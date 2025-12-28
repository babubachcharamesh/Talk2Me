
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration, Blob } from '@google/genai';
import { SessionStatus, TranscriptionItem, Persona, ConversationSession, User } from './types';
import { decode, decodeAudioData, createPcmBlob } from './utils/audio-utils';
import { exportToTxt } from './utils/export-utils';
import Visualizer from './components/Visualizer';
import TranscriptionPanel from './components/TranscriptionPanel';
import AuthModal from './components/AuthModal';
import AdminPanel from './components/AdminPanel';

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
  }
];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('echosphere_current_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activePersona, setActivePersona] = useState<Persona>(PERSONAS[0]);
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const sessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  const theme = useMemo(() => {
    const map: Record<string, any> = {
      rose: { bg: 'bg-rose-600', border: 'border-rose-500/30', glow: 'bg-rose-500', shadow: 'shadow-rose-600/20' },
      blue: { bg: 'bg-blue-600', border: 'border-blue-500/30', glow: 'bg-blue-500', shadow: 'shadow-blue-600/20' },
      amber: { bg: 'bg-amber-600', border: 'border-amber-500/30', glow: 'bg-amber-500', shadow: 'shadow-amber-600/20' },
      orange: { bg: 'bg-orange-600', border: 'border-orange-500/30', glow: 'bg-orange-500', shadow: 'shadow-orange-600/20' },
      purple: { bg: 'bg-purple-600', border: 'border-purple-500/30', glow: 'bg-purple-500', shadow: 'shadow-purple-600/20' },
      emerald: { bg: 'bg-emerald-600', border: 'border-emerald-500/30', glow: 'bg-emerald-500', shadow: 'shadow-emerald-600/20' }
    };
    return map[activePersona.color] || map.blue;
  }, [activePersona]);

  const handleAuth = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('echosphere_current_user', JSON.stringify(newUser));
  };

  const logout = () => {
    stopSession();
    setUser(null);
    localStorage.removeItem('echosphere_current_user');
  };

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setStatus(SessionStatus.IDLE);
  }, []);

  const startSession = useCallback(async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    try {
      setStatus(SessionStatus.CONNECTING);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const outputNode = outputAudioContextRef.current.createGain();
      outputNode.connect(outputAudioContextRef.current.destination);
      
      analyzerRef.current = outputAudioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
      outputNode.connect(analyzerRef.current);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            setStatus(SessionStatus.CONNECTED);
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Transcription
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
              currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const userText = currentInputTranscriptionRef.current.trim();
              const modelText = currentOutputTranscriptionRef.current.trim();
              
              if (userText) {
                setTranscriptions(prev => [...prev, {
                  id: Math.random().toString(36).substr(2, 9),
                  text: userText,
                  role: 'user',
                  timestamp: Date.now()
                }]);
              }
              if (modelText) {
                setTranscriptions(prev => [...prev, {
                  id: Math.random().toString(36).substr(2, 9),
                  text: modelText,
                  role: 'model',
                  timestamp: Date.now()
                }]);
              }
              
              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';
            }

            // Handle Audio output bytes
            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64EncodedAudioString && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
              });
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error('Session error:', e);
            setStatus(SessionStatus.ERROR);
            stopSession();
          },
          onclose: () => {
            setStatus(SessionStatus.IDLE);
            stopSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: activePersona.prompt,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: activePersona.voice } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Failed to start session:', err);
      setStatus(SessionStatus.ERROR);
    }
  }, [user, activePersona, stopSession]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] ${theme.glow} rounded-full blur-[120px] opacity-20 animate-pulse`}></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600 rounded-full blur-[120px] opacity-10"></div>
      </div>

      <nav className="relative z-50 px-8 py-6 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-2xl ${theme.bg} shadow-lg flex items-center justify-center`}>
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white">ECHOSPHERE</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Neural Interaction Lab</p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          {user ? (
            <div className="flex items-center space-x-4">
              {user.isAdmin && (
                <button 
                  onClick={() => setShowAdmin(true)}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Admin Console
                </button>
              )}
              <div className="flex flex-col items-end">
                <span className="text-xs font-black text-white">{user.username}</span>
                <button onClick={logout} className="text-[9px] font-bold text-slate-500 hover:text-rose-400 transition-colors uppercase tracking-wider">Sever Link</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuth(true)}
              className="px-6 py-2.5 bg-white text-slate-950 text-xs font-black uppercase tracking-widest rounded-full hover:bg-slate-200 transition-all shadow-xl"
            >
              Initialize Link
            </button>
          )}
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-4 pb-20 flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-100px)]">
        {/* Left Side: Controls & Persona */}
        <div className="lg:w-1/3 flex flex-col space-y-6">
          <div className="glass rounded-[2.5rem] p-8 border border-white/10 relative overflow-hidden flex flex-col items-center">
            <div className={`absolute top-0 right-0 w-32 h-32 ${theme.glow} rounded-full blur-[60px] opacity-20`}></div>
            
            <div className={`w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-white/10 to-transparent mb-6 transition-all duration-500 ${status === SessionStatus.CONNECTED ? 'scale-110' : ''}`}>
              <div className={`w-full h-full rounded-full ${theme.bg} flex items-center justify-center text-5xl font-black text-white shadow-2xl relative`}>
                {activePersona.name[0]}
                {status === SessionStatus.CONNECTED && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-white/30"></span>
                )}
              </div>
            </div>

            <h2 className="text-3xl font-black text-white mb-1">{activePersona.name}</h2>
            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">{activePersona.label}</p>
            <p className="text-slate-400 text-sm text-center leading-relaxed font-medium px-4 mb-8">
              "{activePersona.description}"
            </p>

            <div className="w-full space-y-3 mb-8">
              {status === SessionStatus.CONNECTED ? (
                <button 
                  onClick={stopSession}
                  className="w-full py-4 bg-rose-600 text-white font-black rounded-2xl shadow-xl shadow-rose-900/20 hover:bg-rose-500 transition-all active:scale-95 flex items-center justify-center space-x-3"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>
                  <span>END TRANSMISSION</span>
                </button>
              ) : (
                <button 
                  disabled={status === SessionStatus.CONNECTING}
                  onClick={startSession}
                  className={`w-full py-4 ${theme.bg} text-white font-black rounded-2xl shadow-xl shadow-black/40 hover:brightness-110 transition-all active:scale-95 flex items-center justify-center space-x-3 disabled:opacity-50`}
                >
                  {status === SessionStatus.CONNECTING ? (
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                      <span>INITIATE LINK</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="w-full">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block ml-1">Switch Neural Signature</label>
              <div className="grid grid-cols-5 gap-2">
                {PERSONAS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (status === SessionStatus.IDLE) setActivePersona(p);
                    }}
                    disabled={status !== SessionStatus.IDLE}
                    className={`aspect-square rounded-xl flex items-center justify-center font-black text-sm transition-all ${
                      activePersona.id === p.id 
                        ? `${theme.bg} text-white scale-110 shadow-lg ring-2 ring-white/20` 
                        : 'bg-white/5 text-slate-500 hover:bg-white/10'
                    } disabled:cursor-not-allowed`}
                    title={p.name}
                  >
                    {p.name[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 border border-white/10">
            <Visualizer 
              isActive={status === SessionStatus.CONNECTED} 
              analyzer={analyzerRef.current || undefined}
              color={activePersona.color}
            />
          </div>
        </div>

        {/* Right Side: Dialogue */}
        <div className="lg:w-2/3 flex flex-col min-h-[500px]">
          <TranscriptionPanel 
            items={transcriptions} 
            onClear={() => setTranscriptions([])}
            personaColor={activePersona.color}
            activeSessionId={user?.id}
            userId={user?.id}
          />
        </div>
      </main>

      {showAuth && (
        <AuthModal 
          onAuth={handleAuth} 
          onClose={() => setShowAuth(false)} 
          theme={theme}
        />
      )}

      {showAdmin && user?.isAdmin && (
        <AdminPanel 
          onClose={() => setShowAdmin(false)} 
          theme={theme}
        />
      )}
    </div>
  );
};

export default App;
