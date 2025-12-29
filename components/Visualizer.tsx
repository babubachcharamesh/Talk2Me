
import React, { useRef, useEffect } from 'react';
import { Emotion } from '../types';

interface VisualizerProps {
  isActive: boolean;
  analyzer?: AnalyserNode;
  color?: string;
  emotion?: Emotion;
}

const colorToHex = (color: string = 'blue') => {
  const map: Record<string, { primary: string; secondary: string }> = {
    rose: { primary: '#e11d48', secondary: '#fb7185' },
    blue: { primary: '#2563eb', secondary: '#60a5fa' },
    amber: { primary: '#d97706', secondary: '#fbbf24' },
    orange: { primary: '#ea580c', secondary: '#fb923c' },
    purple: { primary: '#9333ea', secondary: '#c084fc' },
    emerald: { primary: '#059669', secondary: '#34d399' }
  };
  return map[color] || map.blue;
};

const emotionToHex = (emotion: Emotion = 'NEUTRAL') => {
  const map: Record<Emotion, string> = {
    NEUTRAL: 'transparent',
    HAPPY: '#facc15',
    EXCITED: '#ec4899',
    SAD: '#1e3a8a',
    CONCERNED: '#0891b2',
    ANGRY: '#dc2626',
    THOUGHTFUL: '#14b8a6',
    CURIOUS: '#8b5cf6',
    EMPATHETIC: '#fb923c'
  };
  return map[emotion] || map.NEUTRAL;
};

const Visualizer: React.FC<VisualizerProps> = ({ isActive, analyzer, color, emotion = 'NEUTRAL' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = colorToHex(color);
  // Fix: Explicitly cast emotion as Emotion type to match the parameter type of emotionToHex
  const moodColor = emotionToHex(emotion as Emotion);

  useEffect(() => {
    if (!canvasRef.current || !isActive || !analyzer) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyzer.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;
      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height * 0.8;

        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, theme.primary);
        
        // If there's an active emotion, blend it into the top of the bars
        if (emotion !== 'NEUTRAL') {
          gradient.addColorStop(1, moodColor);
        } else {
          gradient.addColorStop(1, theme.secondary);
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight, barWidth, barHeight, [4, 4, 0, 0]);
        ctx.fill();

        x += barWidth + 2;
      }
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isActive, analyzer, theme, moodColor, emotion]);

  return (
    <div className="relative w-full h-32 flex items-center justify-center pointer-events-none">
      <canvas 
        ref={canvasRef} 
        width={500} 
        height={128} 
        className="w-full max-w-lg h-full rounded-lg"
      />
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-medium select-none animate-pulse">
          Neural link waiting for signal...
        </div>
      )}
    </div>
  );
};

export default Visualizer;
