
import { ConversationSession, Emotion } from '../types';
import { jsPDF } from 'jspdf';

const MOOD_COLORS: Record<Emotion, [number, number, number]> = {
  NEUTRAL: [100, 116, 139],    // Slate 500
  HAPPY: [202, 138, 4],       // Yellow 600
  EXCITED: [219, 39, 119],    // Pink 600
  SAD: [37, 99, 235],         // Blue 600
  CONCERNED: [8, 145, 178],   // Cyan 600
  ANGRY: [220, 38, 38],       // Red 600
  THOUGHTFUL: [13, 148, 136], // Teal 600
  CURIOUS: [124, 58, 237],    // Violet 600
  EMPATHETIC: [234, 88, 12]   // Orange 600
};

export function exportToTxt(session: ConversationSession) {
  const header = `EchoSphere Conversation Transcript\nPersona: ${session.personaId}\nDate: ${new Date(session.timestamp).toLocaleString()}\n-----------------------------------\n\n`;
  const body = session.transcriptions
    .map((item) => `${item.role.toUpperCase()}${item.mood ? ` [${item.mood}]` : ''}: ${item.text}`)
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

export function exportToPdf(session: ConversationSession) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxLineWidth = pageWidth - margin * 2;
  
  const addHeader = (pageNum: number) => {
    // Top Bar
    doc.setFillColor(15, 23, 42); // Slate 950
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Logo Icon
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.rect(margin, 12, 8, 8, 'S');
    doc.line(margin + 2, 16, margin + 6, 16);
    doc.line(margin + 4, 14, margin + 4, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('ECHOSPHERE', margin + 12, 19);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text('NEURAL INTERACTION PROTOCOL // SECURE LOG', margin + 12, 24);
    
    // Page metadata in header
    doc.setFontSize(7);
    doc.text(`SESSION ID: ${session.id.toUpperCase()}`, pageWidth - margin - 40, 18, { align: 'right' });
    doc.text(`DATE: ${new Date(session.timestamp).toLocaleDateString().toUpperCase()}`, pageWidth - margin - 40, 22, { align: 'right' });
    doc.text(`PAGE ${pageNum}`, pageWidth - margin, 18, { align: 'right' });
  };

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('CONFIDENTIAL NEURAL TRANSMISSION // FOR RESEARCH PURPOSES ONLY', pageWidth / 2, pageHeight - 10, { align: 'center' });
  };

  let currentPage = 1;
  addHeader(currentPage);
  
  // Initial Info Block
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.roundedRect(margin, 55, pageWidth - margin * 2, 25, 3, 3, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(241, 245, 249); // Slate 100
  doc.text('PILOT IDENTITY:', margin + 5, 62);
  doc.text('PERSONA MATRIX:', margin + 5, 68);
  doc.text('LINK ESTABLISHED:', margin + 5, 74);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(session.userId.toUpperCase(), margin + 40, 62);
  doc.text(session.personaId.toUpperCase(), margin + 40, 68);
  doc.text(new Date(session.timestamp).toLocaleString().toUpperCase(), margin + 40, 74);
  
  let y = 95;
  
  session.transcriptions.forEach((item, index) => {
    const isUser = item.role === 'user';
    const roleText = isUser ? 'PILOT SIGNAL' : 'AI RESPONSE';
    const mood = item.mood || 'NEUTRAL';
    const moodColor = MOOD_COLORS[mood];
    
    const textLines = doc.splitTextToSize(item.text, maxLineWidth - 10);
    const blockHeight = (textLines.length * 6) + 15;

    // Page Break Check
    if (y + blockHeight > pageHeight - 20) {
      addFooter();
      doc.addPage();
      currentPage++;
      addHeader(currentPage);
      y = 55;
    }

    // Role Indicator Circle
    doc.setFillColor(isUser ? 79 : 148, isUser ? 70 : 163, isUser ? 229 : 184); // Indigo 500 or Slate 400
    doc.circle(margin + 2, y + 1, 1.5, 'F');

    // Role text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(isUser ? 79 : 100, isUser ? 70 : 116, isUser ? 229 : 139);
    doc.text(roleText, margin + 6, y + 2);

    // Mood Tag (for Model)
    if (!isUser) {
      doc.setFillColor(...moodColor);
      doc.roundedRect(margin + 30, y - 1, 20, 4, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(5);
      doc.text(mood, margin + 40, y + 2, { align: 'center' });
    }

    y += 8;

    // Message Text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text(textLines, margin + 6, y);
    
    y += (textLines.length * 6) + 10;

    // Separator line
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y - 5, pageWidth - margin, y - 5);
  });
  
  addFooter();
  doc.save(`echosphere_log_${session.id.substring(0, 8)}.pdf`);
}
