
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Persona } from '../types';
import Avatar from './Avatar';
import { playPersonaSample } from '../utils/audio-utils';

interface AdminPanelProps {
  onClose: () => void;
  theme: any;
}

const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
const COLORS = ['rose', 'blue', 'amber', 'orange', 'purple', 'emerald'];
const CLASSIFICATIONS = ['Father', 'Mother', 'Son', 'Daughter', 'Relative', 'Guardian', 'Friend'];

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, theme }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'personas'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'deactivated'>('all');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persona editing state
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [isAddingPersona, setIsAddingPersona] = useState(false);
  const [personaForm, setPersonaForm] = useState<Partial<Persona>>({
    name: '',
    label: '',
    description: '',
    voice: 'Puck',
    color: 'blue',
    prompt: ''
  });

  const refreshData = () => {
    // Users
    const storedUsers = JSON.parse(localStorage.getItem('echosphere_users') || '[]');
    const enrichedUsers = storedUsers.map((u: any) => {
      const dialogue = JSON.parse(localStorage.getItem(`echosphere_dialogue_${u.id}`) || '[]');
      return { ...u, turnCount: dialogue.length };
    });
    setUsers(enrichedUsers);

    // Personas
    const storedPersonas = JSON.parse(localStorage.getItem('echosphere_personas') || '[]');
    setPersonas(storedPersonas);
  };

  useEffect(() => {
    refreshData();
    window.addEventListener('storage', refreshData);
    return () => window.removeEventListener('storage', refreshData);
  }, []);

  const saveUsers = (updatedUsers: any[]) => {
    const stripped = updatedUsers.map(({ turnCount, ...rest }) => rest);
    localStorage.setItem('echosphere_users', JSON.stringify(stripped));
    setUsers(updatedUsers);
    window.dispatchEvent(new Event('storage'));
  };

  const handleExportUsers = () => {
    const storedUsers = JSON.parse(localStorage.getItem('echosphere_users') || '[]');
    const blob = new Blob([JSON.stringify(storedUsers, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `echosphere_pilots_db_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportUsers = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    setImportProgress(0);

    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = (event.loaded / event.total) * 100;
        setImportProgress(percent);
      }
    };

    reader.onload = (event) => {
      setImportProgress(100);
      // Brief artificial delay to ensure the user sees the completion state
      setTimeout(() => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (Array.isArray(data)) {
            // Validate structure roughly
            const isValid = data.every(u => u.id && u.email && u.username);
            if (isValid) {
              localStorage.setItem('echosphere_users', JSON.stringify(data));
              refreshData();
              alert("System database synchronized. Authorization tables updated.");
            } else {
              throw new Error("Invalid schema");
            }
          }
        } catch (err) {
          alert("Critical failure: The uploaded JSON file does not conform to pilot data protocols.");
        } finally {
          setImportProgress(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }, 600);
    };

    reader.onerror = () => {
      setImportProgress(null);
      alert("Critical error: Link synchronization failed during file read.");
    };

    reader.readAsText(file);
  };

  const savePersonas = (updatedPersonas: Persona[]) => {
    localStorage.setItem('echosphere_personas', JSON.stringify(updatedPersonas));
    setPersonas(updatedPersonas);
    window.dispatchEvent(new StorageEvent('storage', { key: 'echosphere_personas', newValue: JSON.stringify(updatedPersonas) }));
  };

  const toggleUserStatus = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user?.email === 'admin@echosphere.ai') {
      alert("Master Neural Link is system-protected.");
      return;
    }
    const updated = users.map(u => u.id === userId ? { ...u, status: u.status === 'deactivated' ? 'active' : 'deactivated' } : u);
    saveUsers(updated);
  };

  const deleteUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user?.email === 'admin@echosphere.ai') {
      alert("Master Neural Link is system-protected and cannot be purged.");
      return;
    }
    if (confirm(`Are you sure you want to purge pilot ${user?.username}? This action is irreversible.`)) {
      const updatedUsers = users.filter(u => u.id !== userId);
      saveUsers(updatedUsers);
      localStorage.removeItem(`echosphere_dialogue_${userId}`);
      localStorage.removeItem(`echosphere_history_${userId}`);
    }
  };

  const handleEditName = (userId: string) => {
    if (!editName.trim()) return;
    const updated = users.map(u => u.id === userId ? { ...u, username: editName.trim() } : u);
    saveUsers(updated);
    setEditingUserId(null);
  };

  const handlePersonaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddingPersona) {
      const newPersona: Persona = {
        ...personaForm as Persona,
        id: Math.random().toString(36).substr(2, 9)
      };
      savePersonas([...personas, newPersona]);
      setIsAddingPersona(false);
    } else if (editingPersona) {
      const updated = personas.map(p => p.id === editingPersona.id ? { ...p, ...personaForm } as Persona : p);
      savePersonas(updated);
      setEditingPersona(null);
    }
    setPersonaForm({ name: '', label: '', description: '', voice: 'Puck', color: 'blue', prompt: '' });
  };

  const deletePersona = (personaId: string) => {
    if (personas.length <= 1) {
      alert("System Error: At least one neural signature must remain active.");
      return;
    }
    if (confirm("Purge this neural signature? All current users will lose access to this profile.")) {
      const updated = personas.filter(p => p.id !== personaId);
      savePersonas(updated);
    }
  };

  const handlePreview = async (persona: Persona) => {
    setPreviewingId(persona.id);
    await playPersonaSample(persona.voice, persona.name);
    setPreviewingId(null);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || u.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [users, searchTerm, filterStatus]);

  const filteredPersonas = useMemo(() => {
    return personas.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.label.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [personas, searchTerm]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-500">
      <div className={`w-full max-w-6xl h-full max-h-[850px] bg-slate-900 border ${theme.border} rounded-[3rem] flex flex-col overflow-hidden shadow-2xl relative`}>
        <div className={`absolute top-0 right-0 w-96 h-96 ${theme.glow} rounded-full blur-[120px] opacity-20 pointer-events-none`}></div>
        
        <header className="p-8 border-b border-white/5 flex flex-col sm:flex-row items-center justify-between relative z-10 gap-4">
          <div className="flex items-center space-x-6">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tighter">Command Center</h2>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Personnel & Neural Access</p>
            </div>
            <div className="h-10 w-px bg-white/10 hidden sm:block"></div>
            <nav className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
              <button 
                onClick={() => { setActiveTab('users'); setSearchTerm(''); }}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Pilots
              </button>
              <button 
                onClick={() => { setActiveTab('personas'); setSearchTerm(''); }}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'personas' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Signatures
              </button>
            </nav>
          </div>
          <div className="flex items-center space-x-3">
             <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-slate-400 hover:text-white transition-all shadow-lg active:scale-95">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col p-8 relative z-10">
          {/* SEARCH & FILTERS */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <input 
                type="text"
                placeholder={activeTab === 'users' ? "Filter pilots by name or neural signature (email)..." : "Filter signatures..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-12 py-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600 focus:bg-white/10"
              />
              <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            
            {activeTab === 'users' && (
              <div className="flex items-center gap-3">
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                  {['all', 'active', 'deactivated'].map((s) => (
                    <button 
                      key={s}
                      onClick={() => setFilterStatus(s as any)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${filterStatus === s ? 'bg-white text-slate-950 shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                
                <div className="h-10 w-px bg-white/10"></div>
                
                <div className="flex space-x-2">
                  <button 
                    onClick={handleExportUsers}
                    className="p-3 bg-white/5 border border-white/10 text-slate-400 hover:text-white rounded-2xl transition-all hover:bg-white/10 group relative"
                    title="Export Pilot Database (JSON)"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-3 border rounded-2xl transition-all relative group ${importProgress !== null ? 'bg-indigo-500 text-white border-indigo-400 animate-pulse' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
                    title="Import Pilot Database (JSON)"
                    disabled={importProgress !== null}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".json" 
                    onChange={handleImportUsers} 
                  />
                </div>
              </div>
            )}

            {activeTab === 'personas' && (
              <button 
                onClick={() => { setIsAddingPersona(true); setPersonaForm({ voice: 'Puck', color: 'blue', label: 'Guardian' }); }}
                className="bg-emerald-600 text-white px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-xl active:scale-95 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                <span>New Signature</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto border border-white/5 rounded-[2rem] bg-black/20 custom-scrollbar p-1">
            {activeTab === 'users' ? (
              <div className="w-full">
                {/* IMPORT PROGRESS BAR */}
                {importProgress !== null && (
                  <div className="mx-6 my-6 p-6 glass rounded-2xl border border-indigo-500/30 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></div>
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Neural Database Synchronization</span>
                      </div>
                      <span className="text-[10px] font-black text-white bg-indigo-500/20 px-2 py-0.5 rounded-md">{Math.round(importProgress)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)] transition-all duration-300 ease-out" 
                        style={{ width: `${importProgress}%` }}
                      ></div>
                    </div>
                    <p className="mt-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Do not terminate session during pilot record reconciliation.</p>
                  </div>
                )}

                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-900 border-b border-white/10 z-20">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Pilot</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Network Activity</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Commands</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center space-x-4">
                            <Avatar user={user} size="md" />
                            <div>
                              {editingUserId === user.id ? (
                                <div className="flex items-center space-x-2">
                                  <input 
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-sm text-white outline-none focus:border-indigo-500 shadow-inner"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleEditName(user.id)}
                                  />
                                  <button onClick={() => handleEditName(user.id)} className="text-emerald-400 hover:text-white bg-emerald-400/10 p-1.5 rounded-lg transition-all">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <div className="text-sm font-black text-white">{user.username}</div>
                                  {user.isAdmin && <span className="bg-indigo-500 text-white text-[7px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">System Admin</span>}
                                  <button onClick={() => { setEditingUserId(user.id); setEditName(user.username); }} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-opacity p-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  </button>
                                </div>
                              )}
                              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-0.5">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-[10px] text-slate-400">
                            <span className="font-black text-white">{user.turnCount || 0}</span> signals
                          </div>
                          <div className="text-[9px] text-slate-600 font-mono">UID: {user.id}</div>
                        </td>
                        <td className="px-6 py-5">
                           <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${user.status === 'deactivated' ? 'text-rose-400 border-rose-500/20 bg-rose-500/5' : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'}`}>
                             {user.status === 'deactivated' ? 'Severed' : 'Linked'}
                           </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          {user.email !== 'admin@echosphere.ai' && (
                            <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => toggleUserStatus(user.id)} className={`p-2 rounded-xl border ${user.status === 'deactivated' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'}`} title={user.status === 'deactivated' ? "Restore Link" : "Sever Link"}>
                                {user.status === 'deactivated' ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
                              </button>
                              <button onClick={() => deleteUser(user.id)} className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-500/30">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-20 text-center text-slate-600 italic">No pilots found matching current vector filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                {filteredPersonas.map((persona) => (
                  <div key={persona.id} className="glass-card bg-white/5 border border-white/10 rounded-3xl p-6 group hover:border-indigo-500/30 transition-all relative">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-14 h-14 rounded-2xl bg-${persona.color}-600 flex items-center justify-center text-2xl font-black text-white shadow-xl`}>
                        {persona.name[0]}
                      </div>
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => handlePreview(persona)}
                          className={`p-2 bg-white/10 border border-white/10 text-white rounded-xl hover:bg-white/20 transition-all ${previewingId === persona.id ? 'animate-pulse scale-110 bg-indigo-500/20 text-indigo-400' : ''}`}
                          title="Preview Voice"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" /></svg>
                        </button>
                        <button 
                          onClick={() => { setEditingPersona(persona); setPersonaForm(persona); }}
                          className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-500/30"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button 
                          onClick={() => deletePersona(persona.id)}
                          className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-500/30"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    <h3 className="text-xl font-black text-white">{persona.name}</h3>
                    <p className={`text-${persona.color}-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3`}>{persona.label}</p>
                    <p className="text-slate-400 text-xs mb-4 line-clamp-2 leading-relaxed">{persona.description}</p>
                    <div className="flex items-center space-x-3 pt-4 border-t border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-500 uppercase">Voice Matrix</span>
                        <span className="text-[10px] font-bold text-slate-300">{persona.voice}</span>
                      </div>
                      <div className="w-px h-6 bg-white/5"></div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-500 uppercase">Aura Color</span>
                        <span className="text-[10px] font-bold text-slate-300 capitalize">{persona.color}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PERSONA FORM MODAL */}
        {(isAddingPersona || editingPersona) && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95 animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black text-white">
                  {isAddingPersona ? 'Define New Neural Signature' : `Modify ${editingPersona?.name}`}
                </h3>
              </div>
              <form onSubmit={handlePersonaSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                    <input 
                      required
                      placeholder="e.g. Ramesh Kumar Sah"
                      value={personaForm.name}
                      onChange={e => setPersonaForm({...personaForm, name: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Role Classification</label>
                    <select 
                      required
                      value={personaForm.label}
                      onChange={e => setPersonaForm({...personaForm, label: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                    >
                      <option value="" disabled className="bg-slate-900">Select Role</option>
                      {CLASSIFICATIONS.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Public Description</label>
                  <textarea 
                    required
                    placeholder="Briefly describe this family member's personality..."
                    value={personaForm.description}
                    onChange={e => setPersonaForm({...personaForm, description: e.target.value})}
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Voice Synthesis Matrix</label>
                    <select 
                      required
                      value={personaForm.voice}
                      onChange={e => setPersonaForm({...personaForm, voice: e.target.value as any})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                    >
                      {VOICES.map(v => <option key={v} value={v} className="bg-slate-900">{v} (Neural Voice)</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Visual Aura Aura Color</label>
                    <select 
                      required
                      value={personaForm.color}
                      onChange={e => setPersonaForm({...personaForm, color: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                    >
                      {COLORS.map(c => <option key={c} value={c} className="bg-slate-900 capitalize">{c} Aura</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Neural Core Directive (AI Logic)</label>
                  <textarea 
                    required
                    value={personaForm.prompt}
                    onChange={e => setPersonaForm({...personaForm, prompt: e.target.value})}
                    rows={4}
                    placeholder="Instructions for the AI, e.g. You are Ramesh, a wise father..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 resize-none font-mono text-xs leading-relaxed"
                  />
                </div>

                <div className="flex items-center space-x-4 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-white text-slate-950 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 shadow-xl"
                  >
                    Authorize Signature
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsAddingPersona(false); setEditingPersona(null); }}
                    className="px-8 py-4 bg-white/5 text-slate-400 rounded-2xl font-black uppercase tracking-widest hover:text-white transition-all"
                  >
                    Abort
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
