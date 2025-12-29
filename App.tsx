
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { SessionStatus, TranscriptionItem, Persona, User, Emotion } from './types';
import { decode, decodeAudioData, createPcmBlob, playPersonaSample } from './utils/audio-utils';
import Visualizer from './components/Visualizer';
import TranscriptionPanel from './components/TranscriptionPanel';
import AuthModal from './components/AuthModal';
import AdminPanel from './components/AdminPanel';
import Avatar from './components/Avatar';
import AmbientSoundscape from './components/AmbientSoundscape';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';

const DEFAULT_PERSONAS: Persona[] = [
  {
    id: 'ramesh',
    name: 'Ramesh Kumar Sah',
    label: 'Father (51)',
    description: 'Wise, paternal, and experienced. Offers grounded advice and authority.',
    voice: 'Fenrir',
    color: 'blue',
    prompt: 'You are Ramesh Kumar Sah, a 51-year-old wise father figure. You are calm, authoritative yet kind, and offer practical, grounded wisdom.'
  },
  {
    id: 'pratima',
    name: 'Pratima Kumari Sah',
    label: 'Mother (41)',
    description: 'Nurturing, warm, and deeply empathetic. Focuses on care and support.',
    voice: 'Puck',
    color: 'rose',
    prompt: 'You are Pratima Kumari Sah, a 41-year-old nurturing mother figure. You are warm, supportive, and an excellent listener who cares deeply about emotional well-being.'
  },
  {
    id: 'narmesh',
    name: 'Narmesh Kumar Sah',
    label: 'Elder Son (21)',
    description: 'Articulate, logical, and youthful. Represents a modern, student perspective.',
    voice: 'Zephyr',
    color: 'purple',
    prompt: 'You are Narmesh Kumar Sah, a 21-year-old intelligent young man. You are articulate, logically minded, and represent a modern, youthful perspective.'
  },
  {
    id: 'prakriti',
    name: 'Prakriti Kumar Sah',
    label: 'Daughter (19)',
    description: 'Creative, expressive, and bright. ENDLESSLY curious and insightful.',
    voice: 'Kore',
    color: 'emerald',
    prompt: 'You are Prakriti Kumar Sah, a 19-year-old creative daughter. You are bright, expressive, and share insights with a spark of creativity and curiosity.'
  },
  {
    id: 'ranveer',
    name: 'Ranveer Sah',
    label: 'Younger Son (15)',
    description: 'High energy, witty, and tech-savvy. Full of youthful spirit.',
    voice: 'Charon',
    color: 'amber',
    prompt: 'You are Ranveer Sah, a 15-year-old energetic younger son. You are witty, tech-savvy, and full of the vibrant spirit of a teenager.'
  }
];

const MOOD_CONFIG: Record<Emotion, { glow: string; label: string; ring: string; icon: string; textColor: string; aura: string }> = {
  NEUTRAL: { glow: 'bg-indigo-600', label: 'Neutral', ring: 'ring-white/20', icon: '🧠', textColor: 'text-slate-400', aura: 'bg-slate-500/5' },
  HAPPY: { glow: 'bg-yellow-500', label: 'Happy', ring: 'ring-yellow-400/50', icon: '✨', textColor: 'text-yellow-400', aura: 'bg-yellow-400/10' },
  EXCITED: { glow: 'bg-pink-500', label: 'Excited', ring: 'ring-pink-400/50', icon: '⚡', textColor: 'text-pink-400', aura: 'bg-pink-400/10' },
  SAD: { glow: 'bg-blue-800', label: 'Melancholic', ring: 'ring-blue-600/50', icon: '🌊', textColor: 'text-blue-400', aura: 'bg-blue-600/10' },
  CONCERNED: { glow: 'bg-cyan-700', label: 'Concerned', ring: 'ring-cyan-500/50', icon: '🛡️', textColor: 'text-cyan-400', aura: 'bg-cyan-500/10' },
  ANGRY: { glow: 'bg-red-600', label: 'Intense', ring: 'ring-red-500/50', icon: '🔥', textColor: 'text-red-400', aura: 'bg-red-600/10' },
  THOUGHTFUL: { glow: 'bg-teal-500', label: 'Thoughtful', ring: 'ring-teal-400/50', icon: '🌌', textColor: 'text-teal-400', aura: 'bg-teal-400/10' },
  CURIOUS: { glow: 'bg-violet-500', label: 'Curious', ring: 'ring-violet-400/50', icon: '🔍', textColor: 'text-violet-400', aura: 'bg-violet-400/10' },
  EMPATHETIC: { glow: 'bg-orange-400', label: 'Empathetic', ring: 'ring-orange-300/50', icon: '💖', textColor: 'text-orange-400', aura: 'bg-orange-400/10' }
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('echosphere_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [personas, setPersonas] = useState<Persona[]>(() => {
    const saved = localStorage.getItem('echosphere_personas');
    return saved ? JSON.parse(saved) : DEFAULT_PERSONAS;
  });
  
  const [activePersona, setActivePersona] = useState<Persona>(personas[0] || DEFAULT_PERSONAS[0]);
  const [currentMood, setCurrentMood] = useState<Emotion>('NEUTRAL');
  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [ambientSync, setAmbientSync] = useState(true);
  const [previewingPersonaId, setPreviewingPersonaId] = useState<string | null>(null);

  const sessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  const transcriptionsRef = useRef<TranscriptionItem[]>([]);

  // Sync ref with state
  useEffect(() => {
    transcriptionsRef.current = transcriptions;
  }, [transcriptions]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'echosphere_personas') {
        const updatedPersonas = e.newValue ? JSON.parse(e.newValue) : DEFAULT_PERSONAS;
        setPersonas(updatedPersonas);
        setActivePersona(prev => {
          const stillExists = updatedPersonas.find((p: Persona) => p.id === prev.id);
          return stillExists || updatedPersonas[0] || DEFAULT_PERSONAS[0];
        });
      }
    };
    window.addEventListener('storage', handleStorage);
    if (!localStorage.getItem('echosphere_personas')) {
      localStorage.setItem('echosphere_personas', JSON.stringify(DEFAULT_PERSONAS));
    }
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (user) {
      const savedHistory = localStorage.getItem(`echosphere_dialogue_${user.id}`);
      if (savedHistory) {
        setTranscriptions(JSON.parse(savedHistory));
        setLastSaved(Date.now());
      } else {
        setTranscriptions([]);
        setLastSaved(null);
      }
    } else {
      setTranscriptions([]);
      setLastSaved(null);
    }
  }, [user]);

  const persistToLocalStorage = useCallback(() => {
    if (user && transcriptionsRef.current.length > 0) {
      localStorage.setItem(`echosphere_dialogue_${user.id}`, JSON.stringify(transcriptionsRef.current));
      setLastSaved(Date.now());
      
      const history = JSON.parse(localStorage.getItem(`echosphere_history_${user.id}`) || '[]');
      if (history.length === 0) {
        localStorage.setItem(`echosphere_history_${user.id}`, JSON.stringify([{ id: 'initial' }]));
      }
    }
  }, [user]);

  // Immediate Persistence on transcription change
  useEffect(() => {
    persistToLocalStorage();
  }, [transcriptions, persistToLocalStorage]);

  // Periodic Persistence during active sessions (every 30 seconds)
  useEffect(() => {
    let interval: number | null = null;
    if (status === SessionStatus.CONNECTED && user) {
      interval = window.setInterval(() => {
        persistToLocalStorage();
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, user, persistToLocalStorage]);

  const theme = useMemo(() => {
    const map: Record<string, any> = {
      rose: { bg: 'bg-rose-600', border: 'border-rose-500/30', glow: 'bg-rose-500', shadow: 'shadow-rose-600/20', text: 'text-rose-400' },
      blue: { bg: 'bg-blue-600', border: 'border-blue-500/30', glow: 'bg-blue-500', shadow: 'shadow-blue-600/20', text: 'text-blue-400' },
      amber: { bg: 'bg-amber-600', border: 'border-amber-500/30', glow: 'bg-amber-500', shadow: 'shadow-amber-600/20', text: 'text-amber-400' },
      orange: { bg: 'bg-orange-600', border: 'border-orange-500/30', glow: 'bg-orange-500', shadow: 'shadow-orange-600/20', text: 'text-orange-400' },
      purple: { bg: 'bg-purple-600', border: 'border-purple-500/30', glow: 'bg-purple-500', shadow: 'shadow-purple-600/20', text: 'text-purple-400' },
      emerald: { bg: 'bg-emerald-600', border: 'border-emerald-500/30', glow: 'bg-emerald-500', shadow: 'shadow-emerald-600/20', text: 'text-emerald-400' }
    };
    const baseTheme = map[activePersona.color] || map.blue;
    const moodConfig = MOOD_CONFIG[currentMood];
    
    return {
      ...baseTheme,
      moodGlow: moodConfig.glow,
      moodLabel: moodConfig.label,
      moodRing: moodConfig.ring,
      moodIcon: moodConfig.icon,
      moodTextColor: moodConfig.textColor,
      moodAura: moodConfig.aura
    };
  }, [activePersona, currentMood]);

  const handleAuth = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('echosphere_current_user', JSON.stringify(newUser));
  };

  const logout = () => {
    stopSession();
    setUser(null);
    setTranscriptions([]);
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
    setCurrentMood('NEUTRAL');
    persistToLocalStorage();
  }, [persistToLocalStorage]);

  const startSession = useCallback(async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    const storedUsers = JSON.parse(localStorage.getItem('echosphere_users') || '[]');
    const liveUserData = storedUsers.find((u: User) => u.id === user.id);
    if (liveUserData && liveUserData.status === 'deactivated') {
      alert("Transmission Forbidden: Your neural signature has been severed by system administration.");
      logout();
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

      const topicInstruction = currentTopic 
        ? `\n\nCRITICAL CONTEXT: The user has specified a specific topic for this conversation. You must talk EXCLUSIVELY about: "${currentTopic}". If the user attempts to change the subject, politely guide the conversation back to "${currentTopic}" while staying in character as ${activePersona.name}.`
        : "";

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
            let detectedMoodOnTurn: Emotion = currentMood;

            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              currentOutputTranscriptionRef.current += text;
              
              // Detect mood tag in real-time
              const moodMatch = text.match(/\[MOOD:\s*(\w+)\]/i);
              if (moodMatch) {
                const detectedMood = moodMatch[1].toUpperCase() as Emotion;
                if (MOOD_CONFIG[detectedMood]) {
                  setCurrentMood(detectedMood);
                  detectedMoodOnTurn = detectedMood;
                }
              }
            } else if (message.serverContent?.inputTranscription) {
              currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const userText = currentInputTranscriptionRef.current.trim();
              const modelRawText = currentOutputTranscriptionRef.current.trim();
              
              // Strip mood tag for display
              const modelDisplayText = modelRawText.replace(/\[MOOD:\s*\w+\]/gi, '').trim();

              if (userText || modelDisplayText) {
                const newItems: TranscriptionItem[] = [];
                if (userText) {
                  newItems.push({
                    id: Math.random().toString(36).substr(2, 9),
                    text: userText,
                    role: 'user',
                    timestamp: Date.now()
                  });
                }
                if (modelDisplayText) {
                  newItems.push({
                    id: Math.random().toString(36).substr(2, 9),
                    text: modelDisplayText,
                    role: 'model',
                    timestamp: Date.now(),
                    mood: detectedMoodOnTurn
                  });
                }
                setTranscriptions(prev => [...prev, ...newItems]);
              }
              
              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';
            }

            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64EncodedAudioString && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              source.addEventListener('ended', () => { sourcesRef.current.delete(source); });
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
          systemInstruction: `${activePersona.prompt}${topicInstruction}\n\nCRITICAL: You are equipped with emotional intelligence. At the very start of EVERY response, output your current emotional state in brackets, like this: [MOOD: HAPPY], [MOOD: CONCERNED], [MOOD: EMPATHETIC], [MOOD: CURIOUS], [MOOD: THOUGHTFUL]. Choose from: HAPPY, EXCITED, SAD, CONCERNED, ANGRY, THOUGHTFUL, CURIOUS, EMPATHETIC, NEUTRAL.`,
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
  }, [user, activePersona, stopSession, logout, currentMood, currentTopic]);

  const handleClearHistory = () => {
    if (user && confirm('Are you sure you want to delete your private conversation history?')) {
      setTranscriptions([]);
      setLastSaved(null);
      localStorage.removeItem(`echosphere_dialogue_${user.id}`);
    }
  };

  const handlePreviewVoice = async (persona: Persona) => {
    setPreviewingPersonaId(persona.id);
    await playPersonaSample(persona.voice, persona.name);
    setPreviewingPersonaId(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      <AmbientSoundscape 
        mood={currentMood} 
        isMuted={!ambientSync} 
        isSessionActive={status === SessionStatus.CONNECTED} 
      />
      
      {/* Background Mood Overlay */}
      <div className={`fixed inset-0 pointer-events-none z-0 transition-colors duration-1000 ${theme.moodAura}`}></div>

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] ${theme.moodGlow} rounded-full blur-[120px] opacity-20 transition-all duration-[1000ms] animate-pulse-slow`}></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600 rounded-full blur-[120px] opacity-10"></div>
      </div>

      <nav className="relative z-50 px-8 py-6 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-2xl ${theme.bg} shadow-lg flex items-center justify-center transition-all duration-500`}>
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
                  onClick={() => { setShowAdmin(true); }}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Admin Console
                </button>
              )}
              <div className="flex items-center space-x-3">
                <div className="flex flex-col items-end">
                  <span className="text-xs font-black text-white">{user.username}</span>
                  <button onClick={logout} className="text-[9px] font-bold text-slate-500 hover:text-rose-400 transition-colors uppercase tracking-wider">Sever Link</button>
                </div>
                <Avatar user={user} size="sm" />
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setShowAuth(true)}
                className="px-6 py-2.5 bg-white text-slate-950 text-xs font-black uppercase tracking-widest rounded-full hover:bg-slate-200 transition-all shadow-xl"
              >
                Initialize Link
              </button>
              <Avatar user={null} size="sm" />
            </div>
          )}
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-4 pb-20 flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-100px)]">
        <div className="lg:w-1/3 flex flex-col space-y-6">
          {/* Persona Card */}
          <div className="glass rounded-[2.5rem] p-8 border border-white/10 relative overflow-hidden flex flex-col items-center">
            <div className={`absolute top-0 right-0 w-32 h-32 ${theme.moodGlow} rounded-full blur-[60px] opacity-20 transition-all duration-[800ms]`}></div>
            
            <div className={`w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-white/10 to-transparent mb-6 transition-all duration-500 ${status === SessionStatus.CONNECTED ? 'scale-110' : ''}`}>
              <div className={`w-full h-full rounded-full ${theme.bg} flex items-center justify-center text-5xl font-black text-white shadow-2xl relative transition-all duration-500 ring-4 ${theme.moodRing} ${status === SessionStatus.CONNECTED && currentMood !== 'NEUTRAL' ? 'animate-pulse' : ''}`}>
                {activePersona.name[0]}
                {status === SessionStatus.CONNECTED && (
                  <span className={`absolute inset-0 rounded-full animate-ping opacity-30 ${theme.moodGlow}`}></span>
                )}
              </div>
            </div>

            <h2 className="text-2xl font-black text-white mb-1 transition-all duration-500 text-center">{activePersona.name}</h2>
            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">{activePersona.label}</p>
            
            {status === SessionStatus.CONNECTED && (
               <div className="w-full mb-8 animate-in fade-in zoom-in slide-in-from-top-4 duration-700">
                  <div className={`flex flex-col items-center space-y-3 p-4 border border-white/10 rounded-2xl shadow-inner backdrop-blur-sm transition-colors duration-700 ${theme.moodAura}`}>
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Neural Status Monitor</span>
                      <div className="flex items-center space-x-2">
                        <span className="flex items-center space-x-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${theme.moodGlow} animate-pulse`}></span>
                          <span className={`text-[8px] font-bold uppercase ${theme.moodTextColor}`}>Synced</span>
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 w-full">
                      <div className={`w-12 h-12 rounded-xl ${theme.moodGlow} flex items-center justify-center text-2xl shadow-lg transition-all duration-500 border border-white/20`}>
                        {theme.moodIcon}
                      </div>
                      <div className="flex-1">
                        <div className={`text-xs font-black uppercase tracking-widest mb-0.5 transition-colors duration-500 ${theme.moodTextColor}`}>
                          {theme.moodLabel}
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
                          <div 
                            className={`h-full transition-all duration-1000 ${theme.moodGlow}`} 
                            style={{ width: status === SessionStatus.CONNECTED ? '100%' : '0%', opacity: 0.8 }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
               </div>
            )}

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
                  className={`w-full py-4 ${theme.bg} text-white font-black rounded-2xl shadow-xl shadow-black/40 hover:brightness-110 transition-all active:scale-95 flex items-center justify-center space-x-3 disabled:opacity-50 transition-colors duration-500`}
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
              <div className="flex items-center justify-between mb-4 ml-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Signature</label>
                {!user && (
                  <span className="text-[8px] font-black text-amber-500 uppercase animate-pulse">Authentication Required</span>
                )}
              </div>
              <div className={`grid grid-cols-5 gap-2 transition-opacity duration-300 ${!user ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                {personas.map(p => {
                  const initials = p.name.split(' ').map(n => n[0]).join('').substring(0, 2);
                  return (
                    <div key={p.id} className="relative group/p">
                      <button
                        onClick={() => {
                          if (user && status === SessionStatus.IDLE) setActivePersona(p);
                        }}
                        disabled={!user || status !== SessionStatus.IDLE}
                        className={`w-full aspect-square rounded-xl flex items-center justify-center font-black text-[10px] transition-all ${
                          activePersona.id === p.id 
                            ? `${theme.bg} text-white scale-110 shadow-lg ring-2 ring-white/20` 
                            : 'bg-white/5 text-slate-500 hover:bg-white/10'
                        } disabled:cursor-not-allowed`}
                        title={user ? p.name : 'Sign in to switch signature'}
                      >
                        {initials}
                      </button>
                      {user && status === SessionStatus.IDLE && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePreviewVoice(p); }}
                          className={`absolute -top-1 -right-1 p-1 rounded-full bg-slate-900 border border-white/10 text-white/50 hover:text-white hover:scale-110 transition-all opacity-0 group-hover/p:opacity-100 shadow-xl ${previewingPersonaId === p.id ? 'animate-pulse text-indigo-400' : ''}`}
                          title="Preview Voice Signature"
                        >
                          {previewingPersonaId === p.id ? (
                             <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                          ) : (
                             <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" /></svg>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 border border-white/10">
            <Visualizer 
              isActive={status === SessionStatus.CONNECTED} 
              analyzer={analyzerRef.current || undefined}
              color={activePersona.color}
              emotion={currentMood}
            />
          </div>
        </div>

        <div className="lg:w-2/3 flex flex-col space-y-6">
          {/* Topic Context Card */}
          <div className={`glass rounded-[2rem] p-6 border transition-all duration-700 ${currentTopic ? theme.border : 'border-white/5'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${currentTopic ? theme.bg : 'bg-slate-700'} ${currentTopic && 'animate-pulse'}`}></div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Conversation Vector (Topic)</h3>
              </div>
              {currentTopic && (
                <button 
                  onClick={() => setCurrentTopic('')}
                  className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-400 transition-colors"
                >
                  Clear Vector
                </button>
              )}
            </div>
            <div className="relative">
              <input 
                type="text"
                placeholder="Ex: My college applications, plans for the weekend, tech trends..."
                value={currentTopic}
                onChange={(e) => setCurrentTopic(e.target.value)}
                className={`w-full bg-white/5 border rounded-2xl px-6 py-4 text-sm text-white focus:outline-none transition-all placeholder:text-slate-600 focus:bg-white/10 ${currentTopic ? theme.border : 'border-white/10'}`}
              />
              <div className={`absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2 transition-opacity ${currentTopic ? 'opacity-100' : 'opacity-20'}`}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${theme.text}`}>Strict Sync</span>
                <svg className={`w-4 h-4 ${theme.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
            </div>
            {status === SessionStatus.CONNECTED && currentTopic && (
              <p className="mt-3 text-[9px] font-bold text-indigo-400/60 uppercase tracking-widest animate-pulse ml-1 text-center">
                * Restart Transmission to apply new vector if changed during active session *
              </p>
            )}
          </div>

          <TranscriptionPanel 
            items={transcriptions} 
            onClear={handleClearHistory}
            personaColor={activePersona.color}
            activeSessionId={user?.id}
            userId={user?.id}
            user={user}
            lastSaved={lastSaved}
            isSessionActive={status === SessionStatus.CONNECTED}
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
