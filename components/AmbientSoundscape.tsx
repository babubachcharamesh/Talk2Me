
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
  const noiseNodeRef = useRef<AudioWorkletNode | BiquadFilterNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);

  // Initialize Audio Context on mount
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0; // Start muted
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.connect(masterGain);
    filterRef.current = filter;

    // Create a simple low-frequency drone system
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.15; // Subtle base volume

    osc1.type = 'sine';
    osc2.type = 'sine';
    
    osc1.connect(oscGain);
    osc2.connect(oscGain);
    oscGain.connect(filter);

    osc1.start();
    osc2.start();

    droneOsc1Ref.current = osc1;
    droneOsc2Ref.current = osc2;

    return () => {
      ctx.close();
    };
  }, []);

  // Handle Mute and Session Status
  useEffect(() => {
    if (!masterGainRef.current || !audioCtxRef.current) return;
    
    const ctx = audioCtxRef.current;
    const targetGain = (isMuted || !isSessionActive) ? 0 : 0.08;
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    masterGainRef.current.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.5);
  }, [isMuted, isSessionActive]);

  // Handle Mood Changes
  useEffect(() => {
    if (!audioCtxRef.current || !droneOsc1Ref.current || !droneOsc2Ref.current || !filterRef.current) return;

    const ctx = audioCtxRef.current;
    const osc1 = droneOsc1Ref.current;
    const osc2 = droneOsc2Ref.current;
    const filter = filterRef.current;
    const now = ctx.currentTime;

    // Emotional Soundscape Mapping
    switch (mood) {
      case 'HAPPY':
      case 'EXCITED':
        osc1.frequency.setTargetAtTime(164.81, now, 1); // E3
        osc2.frequency.setTargetAtTime(207.65, now, 1); // G#3
        osc1.type = 'sine';
        filter.frequency.setTargetAtTime(1200, now, 1);
        break;
      case 'SAD':
      case 'CONCERNED':
        osc1.frequency.setTargetAtTime(55.00, now, 1); // A1
        osc2.frequency.setTargetAtTime(65.41, now, 1); // C2
        osc1.type = 'sine';
        filter.frequency.setTargetAtTime(200, now, 1);
        break;
      case 'ANGRY':
        osc1.frequency.setTargetAtTime(82.41, now, 1); // E2
        osc2.frequency.setTargetAtTime(87.31, now, 1); // F2
        osc1.type = 'sawtooth';
        filter.frequency.setTargetAtTime(400, now, 1);
        filter.Q.setTargetAtTime(10, now, 1);
        break;
      case 'THOUGHTFUL':
      case 'CURIOUS':
        osc1.frequency.setTargetAtTime(220.00, now, 1); // A3
        osc2.frequency.setTargetAtTime(233.08, now, 1); // Bb3
        osc1.type = 'sine';
        filter.frequency.setTargetAtTime(800, now, 1);
        break;
      case 'EMPATHETIC':
        osc1.frequency.setTargetAtTime(130.81, now, 1); // C3
        osc2.frequency.setTargetAtTime(174.61, now, 1); // F3
        osc1.type = 'sine';
        filter.frequency.setTargetAtTime(350, now, 1);
        break;
      default: // NEUTRAL
        osc1.frequency.setTargetAtTime(110.00, now, 1); // A2
        osc2.frequency.setTargetAtTime(111.00, now, 1); // Slight detune
        osc1.type = 'sine';
        filter.frequency.setTargetAtTime(400, now, 1);
        filter.Q.setTargetAtTime(1, now, 1);
        break;
    }
  }, [mood]);

  return null; // Logic-only component
};

export default AmbientSoundscape;
