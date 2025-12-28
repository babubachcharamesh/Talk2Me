
export interface TranscriptionItem {
  id: string;
  text: string;
  role: 'user' | 'model';
  timestamp: number;
  mood?: Emotion;
}

export type Emotion = 'NEUTRAL' | 'HAPPY' | 'EXCITED' | 'SAD' | 'CONCERNED' | 'ANGRY' | 'THOUGHTFUL' | 'CURIOUS' | 'EMPATHETIC';

export enum SessionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  FINISHED = 'FINISHED',
  ERROR = 'ERROR',
  AUTHENTICATING = 'AUTHENTICATING',
}

export interface User {
  id: string;
  username: string;
  email: string;
  isAdmin?: boolean;
  status?: 'active' | 'deactivated';
  createdAt?: number;
}

export interface Persona {
  id: string;
  name: string;
  label: string;
  description: string;
  voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  prompt: string;
  color: string;
}

export interface ConversationSession {
  id: string;
  userId: string;
  personaId: string;
  timestamp: number;
  transcriptions: TranscriptionItem[];
  lastTone: string;
  title: string;
}
