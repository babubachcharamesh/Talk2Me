
import React, { useEffect, useRef } from 'react';
import { Emotion } from '../types';

interface AmbientSoundscapeProps {
  mood: Emotion;
  isMuted: boolean;
  isSessionActive: boolean;
}

const AmbientSoundscape: React.FC<AmbientSoundscapeProps> = ({ mood, isMuted, isSessionActive }) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const droneOsc1Ref = useRef<OscillatorNode | null>(null);
  const droneOsc2Ref = useRef<OscillatorNode | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);

  // Initialize Audio Context on mount
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0; 
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 1;
    filter.connect(masterGain);
    filterRef.current = filter;

    // Layer 1: The Drone (Sine-Beating)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.08;

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.value = 110; 
    osc2.frequency.value = 110.5; // Slight detune for "beating"

    osc1.connect(oscGain);
    osc2.connect(oscGain);
    oscGain.connect(filter);

    osc1.start();
    osc2.start();
    droneOsc1Ref.current = osc1;
    droneOsc2Ref.current = osc2;

    // Layer 2: Texture (Brown Noise)
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // Gain adjustment
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.04;
    noise.connect(noiseGain);
    noiseGain.connect(filter);
    noise.start();
    noiseSourceRef.current = noise;

    return () => {
      ctx.close();
    };
  }, []);

  // Handle Mute and Session Status
  useEffect(() => {
    if (!masterGainRef.current || !audioCtxRef.current) return;
    
    const ctx = audioCtxRef.current;
    const targetGain = (isMuted || !isSessionActive) ? 0 : 0.12;
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    masterGainRef.current.gain.setTargetAtTime(targetGain, ctx.currentTime, 1.5);
  }, [isMuted, isSessionActive]);

  // Handle Mood Changes
  useEffect(() => {
    if (!audioCtxRef.current || !droneOsc1Ref.current || !droneOsc2Ref.current || !filterRef.current) return;

    const ctx = audioCtxRef.current;
    const osc1 = droneOsc1Ref.current;
    const osc2 = droneOsc2Ref.current;
    const filter = filterRef.current;
    const now = ctx.currentTime;

    const transitionTime = 2.5;

    switch (mood) {
      case 'HAPPY':
        osc1.frequency.setTargetAtTime(196.00, now, transitionTime); // G3
        osc2.frequency.setTargetAtTime(196.80, now, transitionTime); 
        osc1.type = 'sine';
        filter.frequency.setTargetAtTime(1500, now, transitionTime);
        filter.Q.setTargetAtTime(0.5, now, transitionTime);
        break;
      case 'EXCITED':
        osc1.frequency.setTargetAtTime(261.63, now, transitionTime); // C4
        osc2.frequency.setTargetAtTime(263.20, now, transitionTime); // Faster beating
        osc1.type = 'sine';
        filter.frequency.setTargetAtTime(2200, now, transitionTime);
        filter.Q.setTargetAtTime(2, now, transitionTime);
        break;
      case 'SAD':
        osc1.frequency.setTargetAtTime(65.41, now, transitionTime); // C2
        osc2.frequency.setTargetAtTime(65.61, now, transitionTime); 
        osc1.type = 'sine';
        filter.frequency.setTargetAtTime(180, now, transitionTime);
        filter.Q.setTargetAtTime(1, now, transitionTime);
        break;
      case 'ANGRY':
        osc1.frequency.setTargetAtTime(82.41, now, transitionTime); // E2
        osc2.frequency.setTargetAtTime(84.50, now, transitionTime); 
        osc1.type = 'sawtooth';
        filter.frequency.setTargetAtTime(600, now, transitionTime);
        filter.Q.setTargetAtTime(12, now, transitionTime);
        break;
      case 'THOUGHTFUL':
      case 'CURIOUS':
        osc1.frequency.setTargetAtTime(220.00, now, transitionTime); // A3
        osc2.frequency.setTargetAtTime(220.30, now, transitionTime); 
        osc1.type = 'sine';
        filter.frequency.setTargetAtTime(900, now, transitionTime);
        filter.Q.setTargetAtTime(1, now, transitionTime);
        break;
      case 'EMPATHETIC':
        osc1.frequency.setTargetAtTime(174.61, now, transitionTime); // F3
        osc2.frequency.setTargetAtTime(174.91, now, transitionTime); 
        osc1.type = 'sine';
        filter.frequency.setTargetAtTime(450, now, transitionTime);
        filter.Q.setTargetAtTime(1, now, transitionTime);
        break;
      default: // NEUTRAL
        osc1.frequency.setTargetAtTime(110.00, now, transitionTime); // A2
        osc2.frequency.setTargetAtTime(110.40, now, transitionTime);
        osc1.type = 'sine';
        filter.frequency.setTargetAtTime(400, now, transitionTime);
        filter.Q.setTargetAtTime(1, now, transitionTime);
        break;
    }
  }, [mood]);

  return null;
};

export default AmbientSoundscape;
