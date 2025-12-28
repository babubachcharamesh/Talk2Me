
import React, { useState, useEffect, useMemo } from 'react';
import { User, ConversationSession } from '../types';

interface AdminPanelProps {
  onClose: () => void;
  theme: any;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, theme }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'deactivated'>('all');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Fetch users and enrich with session counts
  useEffect(() => {
    const refreshData = () => {
      const storedUsers = JSON.parse(localStorage.getItem('echosphere_users') || '[]');
      const enrichedUsers = storedUsers.map((u: any) => {
        const history = JSON.parse(localStorage.getItem(`echosphere_history_${u.id}`) || '[]');
        return { ...u, sessionCount: history.length };
      });
      setUsers(enrichedUsers);
    };
    refreshData();
    window.addEventListener('storage', refreshData);
    return () => window.removeEventListener('storage', refreshData);
  }, []);

  const saveUsers = (updatedUsers: any[]) => {
    // Strip sensitive fields before saving back if necessary, but here we simulate a DB
    localStorage.setItem('echosphere_users', JSON.stringify(updatedUsers.map(u => {
      const { sessionCount, ...rest } = u;
      return rest;
    })));
    setUsers(updatedUsers);
  };

  const toggleUserStatus = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user?.email === 'admin@echosphere.ai') return; // Protect master admin
    
    const updated = users.map(u => 
      u.id === userId 
        ? { ...u, status: u.status === 'deactivated' ? 'active' : 'deactivated' } 
        : u
    );
    saveUsers(updated);
  };

  const deleteUser = (userId: string) => {
    if (confirm('Are you sure you want to purge this user? All their neural logs and account data will be permanently deleted.')) {
      const updatedUsers = users.filter(u => u.id !== userId);
      saveUsers(updatedUsers);
      localStorage.removeItem(`echosphere_history_${userId}`);
    }
  };

  const handleEditName = (userId: string) => {
    const updated = users.map(u => u.id === userId ? { ...u, username: editName } : u);
    saveUsers(updated);
    setEditingUserId(null);
  };

  const forcePasswordReset = (userId: string) => {
    alert(`System signal sent. User ${userId} will be required to verify identity on next link attempt (Simulated).`);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || u.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [users, searchTerm, filterStatus]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-xl animate-in fade-in duration-500">
      <div className={`w-full max-w-6xl h-full max-h-[850px] bg-slate-900 border ${theme.border} rounded-[3rem] flex flex-col overflow-hidden shadow-2xl relative`}>
        {/* Animated Background Gradients */}
        <div className={`absolute top-0 right-0 w-96 h-96 ${theme.glow} rounded-full blur-[120px] opacity-20`}></div>
        <div className={`absolute bottom-0 left-0 w-64 h-64 ${theme.glow} rounded-full blur-[100px] opacity-10`}></div>

        <header className="p-8 border-b border-white/5 flex flex-col sm:flex-row items-center justify-between relative z-10 gap-4">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter">Command Center</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Personnel Management Protocols</p>
          </div>
          <div className="flex items-center space-x-3">
             <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                {['all', 'active', 'deactivated'].map((s) => (
                  <button 
                    key={s}
                    onClick={() => setFilterStatus(s as any)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${filterStatus === s ? 'bg-white text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {s}
                  </button>
                ))}
             </div>
             <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-slate-400 hover:text-white transition-all">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col p-8 relative z-10">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Neural Pilots</div>
              <div className="text-2xl font-black text-white">{users.length}</div>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Links</div>
              <div className="text-2xl font-black text-emerald-400">{users.filter(u => u.status !== 'deactivated').length}</div>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Archived Sessions</div>
              <div className="text-2xl font-black text-indigo-400">{users.reduce((acc, u) => acc + (u.sessionCount || 0), 0)}</div>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">System Health</div>
              <div className="text-2xl font-black text-emerald-400 flex items-center space-x-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                <span>Optimized</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mb-6 relative">
            <input 
              type="text"
              placeholder="Search by callsign or frequency (email)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-12 py-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
            />
            <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>

          {/* User Table */}
          <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/5 rounded-2xl bg-black/20">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-slate-900 border-b border-white/10 z-20">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Pilot</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Metadata</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Link Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Command Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-xl ${theme.bg} flex items-center justify-center font-black text-sm text-white shadow-lg`}>
                          {user.username[0].toUpperCase()}
                        </div>
                        <div>
                          {editingUserId === user.id ? (
                            <div className="flex items-center space-x-2">
                              <input 
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="bg-white/10 border border-white/20 rounded-md px-2 py-1 text-sm text-white outline-none focus:border-indigo-500"
                                autoFocus
                              />
                              <button onClick={() => handleEditName(user.id)} className="text-emerald-400 hover:text-emerald-300">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <div className="text-sm font-black text-white">{user.username}</div>
                              {user.isAdmin && <span className="bg-indigo-500/20 text-indigo-400 text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter">Admin</span>}
                              <button 
                                onClick={() => { setEditingUserId(user.id); setEditName(user.username); }}
                                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-400 transition-opacity"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500 font-medium">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col space-y-1">
                        <div className="text-[10px] text-slate-400">
                          <span className="font-bold">{user.sessionCount || 0}</span> sessions logged
                        </div>
                        <div className="text-[10px] text-slate-500">
                          ID: <span className="font-mono">{user.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${user.status === 'deactivated' ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse`}></div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${user.status === 'deactivated' ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {user.status === 'deactivated' ? 'Offline / Severed' : 'Online / Linked'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {user.email !== 'admin@echosphere.ai' ? (
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => toggleUserStatus(user.id)}
                            className={`p-2 rounded-xl transition-all border ${user.status === 'deactivated' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'}`}
                            title={user.status === 'deactivated' ? "Activate Link" : "Sever Link"}
                          >
                             {user.status === 'deactivated' ? (
                               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                             ) : (
                               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                             )}
                          </button>
                          
                          <button 
                            onClick={() => forcePasswordReset(user.id)}
                            className="p-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 rounded-xl transition-all"
                            title="Force Neural Reset"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                          </button>

                          <button 
                            onClick={() => deleteUser(user.id)}
                            className="p-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 rounded-xl transition-all"
                            title="Purge Pilot Data"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-slate-700 uppercase italic">System Protected</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center text-slate-600">
                      <div className="flex flex-col items-center space-y-4">
                        <svg className="w-12 h-12 opacity-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <p className="text-sm italic">No neural signatures detected matching your parameters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <footer className="p-6 border-t border-white/5 bg-black/20 flex justify-between items-center z-10">
           <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
             System Log: {new Date().toLocaleTimeString()} • All commands encrypted
           </div>
           <button 
             onClick={() => window.print()}
             className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest flex items-center space-x-2"
           >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
             <span>Generate Hardcopy Log</span>
           </button>
        </footer>
      </div>
    </div>
  );
};

export default AdminPanel;
