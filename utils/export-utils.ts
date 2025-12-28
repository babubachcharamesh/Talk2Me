
import { ConversationSession } from '../types';

export function exportToTxt(session: ConversationSession) {
  const header = `EchoSphere Conversation Transcript\nPersona: ${session.personaId}\nDate: ${new Date(session.timestamp).toLocaleString()}\n-----------------------------------\n\n`;
  const body = session.transcriptions
    .map((item) => `${item.role.toUpperCase()}: ${item.text}`)
    .join('\n\n');
  
  const blob = new Blob([header + body], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `echosphere_transcript_${session.id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToJson(session: ConversationSession) {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `echosphere_transcript_${session.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
