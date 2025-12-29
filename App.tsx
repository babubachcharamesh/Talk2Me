
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { SessionStatus, TranscriptionItem, Persona, User, Emotion } from './types';
import { decode, decodeAudioData, createPcmBlob, playPersonaSample, encode } from './utils/audio-utils';
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [ambientSync, setAmbientSync] = useState(true);
  const [previewingPersonaId, setPreviewingPersonaId] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'VOICE' | 'TEXT'>('VOICE');
  const [textInputValue, setTextInputValue] = useState('');
  const [isSendingText, setIsSendingText] = useState(false);

  const sessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
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
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current.onaudioprocess = null;
      scriptProcessorRef.current = null;
    }

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {}
      sessionRef.current = null;
    }

    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close().catch(() => {});
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close().catch(() => {});
      outputAudioContextRef.current = null;
    }

    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
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

    stopSession();
    setErrorMessage(null);

    let stream: MediaStream | null = null;
    if (inputMode === 'VOICE') {
      try {
        setStatus(SessionStatus.CONNECTING);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err: any) {
        console.error('Microphone access failed:', err);
        setErrorMessage("Microphone access denied. Please check your browser permissions.");
        setStatus(SessionStatus.ERROR);
        return;
      }
    } else {
      setStatus(SessionStatus.CONNECTED);
      // For text mode, we just set the status to connected to show the chat UI
      // We don't actually need a "live" bridge unless we want to use it for text
      // But we'll use generateContent for textTurns to keep it simpler
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      await inCtx.resume();
      await outCtx.resume();
      
      inputAudioContextRef.current = inCtx;
      outputAudioContextRef.current = outCtx;
      
      const outputNode = outCtx.createGain();
      outputNode.connect(outCtx.destination);
      
      analyzerRef.current = outCtx.createAnalyser();
      analyzerRef.current.fftSize = 256;
      outputNode.connect(analyzerRef.current);

      const topicInstruction = currentTopic 
        ? `\n\nCRITICAL CONTEXT: The user has specified a specific topic: "${currentTopic}". Talk EXCLUSIVELY about this topic.`
        : "";

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            setErrorMessage(null);
            setStatus(SessionStatus.CONNECTED);
            
            if (stream) {
              const source = inCtx.createMediaStreamSource(stream);
              const scriptProcessor = inCtx.createScriptProcessor(4096, 1, 1);
              scriptProcessorRef.current = scriptProcessor;
              
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                
                sessionPromise.then((session) => {
                  if (session && scriptProcessorRef.current) {
                    session.sendRealtimeInput({ media: pcmBlob });
                  }
                }).catch(() => {
                  if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
                });
              };
              
              source.connect(scriptProcessor);
              scriptProcessor.connect(inCtx.destination);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            let detectedMoodOnTurn: Emotion = currentMood;

            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              currentOutputTranscriptionRef.current += text;
              
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

            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
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
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error('Session error:', e);
            setErrorMessage("Neural bridge collapsed. Recovering system...");
            setStatus(SessionStatus.ERROR);
            stopSession();
          },
          onclose: () => {
            if (status !== SessionStatus.ERROR) {
              setStatus(SessionStatus.IDLE);
              stopSession();
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `${activePersona.prompt}${topicInstruction}\n\nCRITICAL: You are an interactive voice assistant. You MUST respond with audio. Start EVERY response with your mood in brackets: [MOOD: HAPPY], [MOOD: THOUGHTFUL], etc. Speak naturally and concisely.`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: activePersona.voice } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error('Failed to start session:', err);
      setErrorMessage("System failed to establish neural link. Retrying...");
      setStatus(SessionStatus.ERROR);
      stopSession();
    }
  }, [user, activePersona, stopSession, currentMood, currentTopic, status, inputMode]);

  const handleSendText = async () => {
    if (!textInputValue.trim() || !user || isSendingText) return;
    
    const textToSend = textInputValue.trim();
    setTextInputValue('');
    setIsSendingText(true);

    // Add user message to transcript
    const userMsgId = Math.random().toString(36).substr(2, 9);
    setTranscriptions(prev => [...prev, {
      id: userMsgId,
      text: textToSend,
      role: 'user',
      timestamp: Date.now()
    }]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const topicInstruction = currentTopic 
        ? `\n\nCRITICAL CONTEXT: The user has specified a specific topic: "${currentTopic}". Talk EXCLUSIVELY about this topic.`
        : "";

      // Ensure output context is ready
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      await outputAudioContextRef.current.resume();
      
      const outCtx = outputAudioContextRef.current;
      const outputNode = outCtx.createGain();
      outputNode.connect(outCtx.destination);
      
      if (!analyzerRef.current) {
        analyzerRef.current = outCtx.createAnalyser();
        analyzerRef.current.fftSize = 256;
      }
      outputNode.connect(analyzerRef.current);

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [
          // Basic history context
          ...transcriptions.slice(-10).map(t => ({ role: t.role, parts: [{ text: t.text }] })),
          { role: 'user', parts: [{ text: textToSend }] }
        ],
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `${activePersona.prompt}${topicInstruction}\n\nCRITICAL: You are an interactive voice assistant. You MUST respond with audio. Start EVERY response with your mood in brackets: [MOOD: HAPPY], [MOOD: THOUGHTFUL], etc. Speak naturally and concisely.`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: activePersona.voice } }
          }
        }
      });

      const responseText = response.text || '';
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      let detectedMood: Emotion = 'NEUTRAL';
      const moodMatch = responseText.match(/\[MOOD:\s*(\w+)\]/i);
      if (moodMatch) {
        const m = moodMatch[1].toUpperCase() as Emotion;
        if (MOOD_CONFIG[m]) detectedMood = m;
      }

      setCurrentMood(detectedMood);
      const displayContent = responseText.replace(/\[MOOD:\s*\w+\]/gi, '').trim();

      // Add model response to transcript
      setTranscriptions(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        text: displayContent,
        role: 'model',
        timestamp: Date.now(),
        mood: detectedMood
      }]);

      // Play audio response
      if (base64Audio) {
        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
        const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
        const source = outCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputNode);
        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;
      }

    } catch (err) {
      console.error('Text sending failed:', err);
      setErrorMessage("System failed to synthesize response.");
    } finally {
      setIsSendingText(false);
    }
  };

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
          <button 
            onClick={() => setAmbientSync(!ambientSync)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-2xl border transition-all duration-500 ${ambientSync ? `${theme.border} bg-white/5` : 'border-white/5 opacity-50'}`}
          >
            <div className={`w-2 h-2 rounded-full ${ambientSync ? `${theme.bg} animate-pulse` : 'bg-slate-600'}`}></div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${ambientSync ? 'text-white' : 'text-slate-500'}`}>Resonance</span>
          </button>

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
          <div className="glass rounded-[2.5rem] p-8 border border-white/10 relative overflow-hidden flex flex-col items-center">
            <div className={`absolute top-0 right-0 w-32 h-32 ${theme.moodGlow} rounded-full blur-[60px] opacity-20 transition-all duration-[800ms]`}></div>
            
            <div className={`w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-white/10 to-transparent mb-6 transition-all duration-500 ${status === SessionStatus.CONNECTED ? 'scale-110' : ''}`}>
              <div className={`w-full h-full rounded-full ${theme.bg} flex items-center justify-center text-5xl font-black text-white shadow-2xl relative transition-all duration-500 ring-4 ${theme.moodRing}`}>
                {activePersona.name[0]}
              </div>
            </div>

            <h2 className="text-2xl font-black text-white mb-1 transition-all duration-500 text-center">{activePersona.name}</h2>
            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">{activePersona.label}</p>
            
            <div className="flex p-1 bg-white/5 rounded-2xl mb-8 w-full border border-white/10">
              <button 
                onClick={() => setInputMode('VOICE')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center space-x-2 ${inputMode === 'VOICE' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" /></svg>
                <span>Voice</span>
              </button>
              <button 
                onClick={() => setInputMode('TEXT')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center space-x-2 ${inputMode === 'TEXT' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" /></svg>
                <span>Text</span>
              </button>
            </div>

            {status === SessionStatus.CONNECTED && (
               <div className="w-full mb-8 animate-in fade-in zoom-in duration-700">
                  <div className={`flex flex-col items-center space-y-3 p-4 border border-white/10 rounded-2xl shadow-inner backdrop-blur-sm transition-colors duration-700 ${theme.moodAura}`}>
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Neural Status Monitor</span>
                      <span className="flex items-center space-x-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${theme.moodGlow} animate-pulse`}></span>
                        <span className={`text-[8px] font-bold uppercase ${theme.moodTextColor}`}>Synced</span>
                      </span>
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
                          <div className={`h-full transition-all duration-1000 ${theme.moodGlow}`} style={{ width: '100%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
               </div>
            )}

            {errorMessage && (
              <div className="w-full mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in slide-in-from-top-2">
                <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider leading-relaxed">{errorMessage}</p>
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
                  className={`w-full py-4 ${theme.bg} text-white font-black rounded-2xl shadow-xl shadow-black/40 hover:brightness-110 transition-all active:scale-95 flex items-center justify-center space-x-3 disabled:opacity-50`}
                >
                  {status === SessionStatus.CONNECTING ? 'SYNCHRONIZING...' : (inputMode === 'VOICE' ? 'INITIATE VOICE LINK' : 'START TEXT CHAT')}
                </button>
              )}
            </div>

            <div className="w-full">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4 ml-1">Neural Signature</label>
              <div className={`grid grid-cols-5 gap-2 transition-opacity duration-300 ${!user ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                {personas.map(p => (
                  <button
                    key={p.id}
                    onClick={() => (status === SessionStatus.IDLE || status === SessionStatus.ERROR) && setActivePersona(p)}
                    className={`w-full aspect-square rounded-xl flex items-center justify-center font-black text-[10px] transition-all ${
                      activePersona.id === p.id 
                        ? `${theme.bg} text-white scale-110 shadow-lg ring-2 ring-white/20` 
                        : 'bg-white/5 text-slate-500 hover:bg-white/10'
                    }`}
                  >
                    {p.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
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
              emotion={currentMood}
            />
          </div>
        </div>

        <div className="lg:w-2/3 flex flex-col space-y-6">
          <div className={`glass rounded-[2rem] p-6 border transition-all duration-700 ${currentTopic ? theme.border : 'border-white/5'}`}>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Conversation Vector (Topic)</h3>
            <input 
              type="text"
              placeholder="Ex: My college applications, plans for the weekend, tech trends..."
              value={currentTopic}
              onChange={(e) => setCurrentTopic(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0">
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

            {status === SessionStatus.CONNECTED && inputMode === 'TEXT' && (
              <div className="mt-4 glass rounded-3xl p-4 border border-white/10 flex items-center space-x-4 animate-in slide-in-from-bottom-4 duration-500">
                <input 
                  type="text"
                  placeholder={`Speak to ${activePersona.name}...`}
                  value={textInputValue}
                  onChange={(e) => setTextInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                  disabled={isSendingText}
                />
                <button 
                  onClick={handleSendText}
                  disabled={isSendingText || !textInputValue.trim()}
                  className={`p-4 rounded-2xl ${theme.bg} text-white shadow-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100`}
                >
                  {isSendingText ? (
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {showAuth && <AuthModal onAuth={handleAuth} onClose={() => setShowAuth(false)} theme={theme} />}
      {showAdmin && user?.isAdmin && <AdminPanel onClose={() => setShowAdmin(false)} theme={theme} />}
    </div>
  );
};

export default App;
