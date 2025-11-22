import React, { useState, useEffect, useRef } from 'react';
import { EventData, Ticket, TicketStatus } from './types';
import EventDetail from './components/EventDetail';
import Validator from './components/Validator';
import { Plus, Archive, Calendar, Search, LayoutGrid, Download, Upload, Edit2, X } from 'lucide-react';
import { getFirebaseServices } from './services/firebaseClient';
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { ref as storageRef, uploadBytes, listAll, getBytes } from 'firebase/storage';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_TIME__: string;

const MANAGER_PASSWORD = 'vipadmin'; // simple built-in password for manager mode

// Helper for random strings
const generateId = (length: number) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 1, 0 to avoid confusion
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Robust UUID generator that works in non-secure contexts
const uuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback if crypto.randomUUID fails
    }
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const App: React.FC = () => {
  // --- State ---
  const [events, setEvents] = useState<EventData[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isHydrated, setIsHydrated] = useState(false); // avoid wiping saved data before load
  const [fireStatus, setFireStatus] = useState<'off' | 'authenticating' | 'ready' | 'error' | 'needs_auth'>('off');
  const [fireError, setFireError] = useState('');
  const [fireUser, setFireUser] = useState<User | null>(null);
  const [fireBusy, setFireBusy] = useState<'idle' | 'uploading' | 'downloading'>('idle');
  const [isManagerAuthenticated, setIsManagerAuthenticated] = useState(false);
  
  // Navigation State
  const [currentView, setCurrentView] = useState<'dashboard' | 'validator' | 'event_detail'>('validator');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false); // New: Edit Modal
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Form State (Shared for Create and Edit)
  const [eventName, setEventName] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null); // Track which event is being edited
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [showArchived, setShowArchived] = useState(false);

  // Ref for file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects (Mock Persistence) ---
  useEffect(() => {
    const storedEvents = localStorage.getItem('vtm_events');
    const storedTickets = localStorage.getItem('vtm_tickets');
    try {
      if (storedEvents) setEvents(JSON.parse(storedEvents));
      if (storedTickets) setTickets(JSON.parse(storedTickets));
    } catch (err) {
      console.error('Failed to parse stored data', err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return; // wait for initial load to avoid wiping existing data
    localStorage.setItem('vtm_events', JSON.stringify(events));
    localStorage.setItem('vtm_tickets', JSON.stringify(tickets));
  }, [events, tickets, isHydrated]);

  useEffect(() => {
    const services = getFirebaseServices();
    if (!services) {
      setFireStatus('off');
      return;
    }
    setFireStatus('authenticating');
    const unsub = onAuthStateChanged(services.auth, (user) => {
      setFireUser(user);
      setFireStatus(user ? 'ready' : 'needs_auth');
    });
    return () => unsub();
  }, []);

  // --- Actions ---

  const openCreateModal = () => {
    setEventName('');
    setEventDesc('');
    setEditingEventId(null);
    setShowCreateModal(true);
  };

  const openEditModal = (event: EventData) => {
    setEventName(event.name);
    setEventDesc(event.description);
    setEditingEventId(event.id);
    setShowEditModal(true);
  };

  const handleCreateEvent = () => {
    if (!eventName.trim()) return;
    const newEvent: EventData = {
      id: uuid(),
      name: eventName,
      description: eventDesc,
      createdAt: Date.now(),
      isArchived: false,
    };
    setEvents([newEvent, ...events]);
    setShowCreateModal(false);
  };

  const handleUpdateEvent = () => {
    if (!editingEventId || !eventName.trim()) return;
    setEvents(events.map(e => e.id === editingEventId ? { ...e, name: eventName, description: eventDesc } : e));
    setShowEditModal(false);
    setEditingEventId(null);
  };

  // Used by EventDetail component to update event
  const handleUpdateEventDirect = (eventId: string, name: string, description: string) => {
     setEvents(events.map(e => e.id === eventId ? { ...e, name, description } : e));
  };

  const handleArchiveEvent = (id: string) => {
    // Removed window.confirm to prevent blocking issues. Users can restore if needed.
    setEvents(events.map(e => e.id === id ? { ...e, isArchived: true } : e));
  };
  
  const handleRestoreEvent = (id: string) => {
      setEvents(events.map(e => e.id === id ? { ...e, isArchived: false } : e));
  };
  
  const handleDeleteEvent = (id: string) => {
    const target = events.find(e => e.id === id);
    if (!target) return;
    const ok = window.confirm(`删除事件 "${target.name}" 将同时删除其所有票据，且无法恢复。确定删除吗？`);
    if (!ok) return;
    setEvents(events.filter(e => e.id !== id));
    setTickets(tickets.filter(t => t.eventId !== id));
    if (selectedEventId === id) {
      setSelectedEventId(null);
      setCurrentView('dashboard');
    }
  };

  const handleGenerateTickets = (eventId: string, count: number, length: number) => {
    const newTickets: Ticket[] = [];
    const existingCodes = new Set(tickets.map(t => t.code));
    
    let attempts = 0;
    while (newTickets.length < count && attempts < count * 5) {
      const code = generateId(length);
      if (!existingCodes.has(code)) {
        newTickets.push({
          id: uuid(),
          eventId,
          code,
          status: TicketStatus.ISSUED,
          generatedAt: Date.now(),
        });
        existingCodes.add(code);
      }
      attempts++;
    }
    setTickets([...tickets, ...newTickets]);
  };

  const handleAddTicketsManual = (eventId: string, codes: string[]) => {
    // Assuming validation happened in the child component
    const newTickets = codes.map(code => ({
      id: uuid(),
      eventId,
      code,
      status: TicketStatus.ISSUED as TicketStatus,
      generatedAt: Date.now(),
    }));
    setTickets([...tickets, ...newTickets]);
  };

  const handleUpdateTicket = (ticketId: string, updates: Partial<Ticket>) => {
    setTickets(tickets.map(t => t.id === ticketId ? { ...t, ...updates } : t));
  };

  const handleDeleteTicket = (ticketId: string) => {
    setTickets(tickets.filter(t => t.id !== ticketId));
  };

  // --- Data Management Actions ---

  const handleExportData = () => {
    const data = {
      version: 1,
      timestamp: Date.now(),
      events,
      tickets
    };
    const now = new Date();
    const datePart = now.toISOString().split('T')[0];
    const timePart = now.toTimeString().slice(0,8).replace(':', '-'); // HH-MM
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vip-ticket-backup-${datePart}-${timePart}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportTrigger = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);

        // Basic validation
        if (!Array.isArray(data.events) || !Array.isArray(data.tickets)) {
          alert('Invalid backup file format.');
          return;
        }

        if (window.confirm(`Found ${data.events.length} events and ${data.tickets.length} tickets. \n\nWARNING: This will REPLACE all current data. Are you sure?`)) {
          setEvents(data.events);
          setTickets(data.tickets);
          alert('Data restored successfully!');
        }
      } catch (err) {
        console.error(err);
        alert('Error parsing the backup file. Please ensure it is a valid JSON file.');
      }
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // --- Firebase Backup / Restore ---
  const getFireServicesOrAlert = () => {
    const services = getFirebaseServices();
    if (!services || fireStatus === 'off') {
      alert('Firebase 未配置，无法使用 Fire Backup。请先在 Vite 环境变量中填写 Firebase 配置信息。');
      return null;
    }
    if (fireStatus === 'error') {
      alert(`Firebase 连接异常：${fireError || '未知错误'}`);
      return null;
    }
    if (fireStatus === 'needs_auth') {
      alert('请先用 Google 登录后再使用 Fire 功能。');
      return null;
    }
    if (!fireUser) {
      alert('尚未登录 Firebase，稍后再试。');
      return null;
    }
    return { ...services, user: fireUser };
  };

  const handleFireBackup = async () => {
    const services = getFireServicesOrAlert();
    if (!services) return;
    setFireBusy('uploading');
    try {
      const now = new Date();
      const datePart = now.toISOString().split('T')[0];
      const timePart = now.toTimeString().slice(0,5).replace(':', '-'); // HH-MM
      const fileName = `vip-ticket-backup-${datePart}-${timePart}.json`;
      const data = {
        version: 1,
        timestamp: Date.now(),
        events,
        tickets
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const fileRef = storageRef(services.storage, `backups/${services.user.uid}/${fileName}`);
      await uploadBytes(fileRef, blob, { contentType: 'application/json' });
      alert(`已上传到云端：${fileName}`);
    } catch (err) {
      console.error('Fire backup failed', err);
      alert('上传失败，请检查网络或 Firebase 配置。');
    } finally {
      setFireBusy('idle');
    }
  };

  const handleFireRestore = async () => {
    const services = getFireServicesOrAlert();
    if (!services) return;
    setFireBusy('downloading');
    try {
      const folderRef = storageRef(services.storage, `backups/${services.user.uid}`);
      const list = await listAll(folderRef);
      if (!list.items.length) {
        alert('云端没有可用备份。');
        return;
      }
      const latest = list.items.sort((a, b) => a.name.localeCompare(b.name)).slice(-1)[0];
      const bytes = await getBytes(latest);
      const text = new TextDecoder().decode(bytes);
      const data = JSON.parse(text);
      if (!Array.isArray(data.events) || !Array.isArray(data.tickets)) {
        alert('备份格式不正确。');
        return;
      }
      if (window.confirm(`发现云备份：${latest.name}\n这将覆盖当前本地数据，确定恢复吗？`)) {
        setEvents(data.events);
        setTickets(data.tickets);
        alert('已从云端恢复完成。');
      }
    } catch (err) {
      console.error('Fire restore failed', err);
      alert('下载失败，请检查网络或 Firebase 配置。');
    } finally {
      setFireBusy('idle');
    }
  };

  const handleFireLogin = async () => {
    const services = getFirebaseServices();
    if (!services) {
      alert('Firebase 未配置，无法登录。');
      return;
    }
    setFireStatus('authenticating');
    setFireError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(services.auth, provider);
    } catch (err: any) {
      console.error('Firebase Google 登录失败', err);
      setFireError(err.message || 'Google 登录失败');
      setFireStatus('error');
    }
  };

  const handleFireLogout = async () => {
    const services = getFirebaseServices();
    if (!services) return;
    await signOut(services.auth);
  };

  // --- Access Control ---
  const requestManagerAccess = () => {
    if (isManagerAuthenticated) {
      setCurrentView('dashboard');
      return;
    }
    setAuthPassword('');
    setAuthError('');
    setShowAuthModal(true);
  };

  const handleAuthSubmit = () => {
    if (authPassword === MANAGER_PASSWORD) {
      setIsManagerAuthenticated(true);
      setShowAuthModal(false);
      setAuthPassword('');
      setAuthError('');
      setCurrentView('dashboard');
      return;
    }
    setAuthError('invalid password! try again.');
  };

  const handleExitManager = () => {
    setIsManagerAuthenticated(false);
    setSelectedEventId(null);
    setCurrentView('validator');
  };

  // --- Render Helpers ---

  const buildMeta = {
    version: typeof __APP_VERSION__ === 'undefined' ? 'dev' : __APP_VERSION__,
    buildTime: typeof __APP_BUILD_TIME__ === 'undefined' ? '' : __APP_BUILD_TIME__,
  };

  const filteredEvents = events.filter(e => showArchived ? e.isArchived : !e.isArchived);
  const authModal = showAuthModal ? (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-xs uppercase text-slate-500 font-semibold tracking-wide">Restricted</p>
            <h2 className="text-xl font-bold text-slate-900">Manager Password</h2>
          </div>
          <button onClick={() => { setShowAuthModal(false); setAuthPassword(''); setAuthError(''); }} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-brand-500 focus:border-brand-500"
            placeholder="Enter manager password"
            value={authPassword}
            onChange={e => { setAuthPassword(e.target.value); setAuthError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleAuthSubmit()}
            autoFocus
          />
          {authError && <p className="text-sm text-red-600">{authError}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button 
            onClick={() => { setShowAuthModal(false); setAuthPassword(''); setAuthError(''); }}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg"
          >
            Cancel
          </button>
          <button 
            onClick={handleAuthSubmit}
            className="px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700"
          >
            Unlock
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // --- Views ---

  if (currentView === 'validator') {
    return (
      <>
        <div className="min-h-screen bg-slate-100 flex flex-col">
          <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center sticky top-0 z-50">
              <div className="font-bold text-xl tracking-tight text-slate-900 flex items-center gap-2">
                  <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">V</div>
                  VIP Ticket Master
              </div>
              <button onClick={requestManagerAccess} className="px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-brand-700 transition-colors flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" /> Manager Mode
              </button>
          </nav>
          <div className="flex-1 py-12">
              <Validator 
                  events={events} 
                  tickets={tickets} 
                  onUpdateTicket={handleUpdateTicket} 
              />
          </div>
          <footer className="px-6 py-3 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
            Version {buildMeta.version} • Built {buildMeta.buildTime || 'dev'}
          </footer>
        </div>
        {authModal}
      </>
    );
  }

  if (currentView === 'event_detail' && !isManagerAuthenticated) {
    return (
      <>
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
          <div className="bg-white shadow-md rounded-xl border border-slate-200 p-8 max-w-md w-full text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full mx-auto mb-3 flex items-center justify-center text-slate-500">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Manager Mode Locked</h2>
            <p className="text-slate-600 mb-6">Enter the manager password to view and edit ticket details.</p>
            <div className="flex flex-col gap-3">
              <button onClick={requestManagerAccess} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700">Unlock Manager Mode</button>
              <button onClick={() => setCurrentView('validator')} className="px-4 py-2 text-brand-700 font-medium hover:underline">Go to Validator</button>
            </div>
          </div>
        </div>
        {authModal}
      </>
    );
  }

  if (currentView === 'event_detail' && selectedEventId) {
    const event = events.find(e => e.id === selectedEventId);
    if (!event) return <div>Event not found</div>;
    return (
      <>
        <div className="min-h-screen bg-slate-50 p-6">
          <div className="max-w-7xl mx-auto">
              <EventDetail 
                  event={event} 
                  tickets={tickets.filter(t => t.eventId === selectedEventId)}
                  onBack={() => setCurrentView('dashboard')}
                  onGenerateTickets={handleGenerateTickets}
                  onAddTicketsManual={handleAddTicketsManual}
                  onDeleteTicket={handleDeleteTicket}
                  onUpdateTicket={handleUpdateTicket}
                  onUpdateEvent={handleUpdateEventDirect}
              />
          </div>
        </div>
        {authModal}
      </>
    );
  }

  // Dashboard View
  if (currentView === 'dashboard' && !isManagerAuthenticated) {
    return (
      <>
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
          <div className="bg-white shadow-lg rounded-2xl border border-slate-200 p-8 max-w-lg w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-brand-100 text-brand-700 rounded-lg flex items-center justify-center font-bold">V</div>
              <div>
                <p className="text-xs uppercase text-slate-500 font-semibold">Manager Mode</p>
                <h1 className="text-2xl font-bold text-slate-900">Authentication Required</h1>
              </div>
            </div>
            <p className="text-slate-600 mb-6">
              Validation is open to everyone. Managing events and tickets requires the manager password.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={requestManagerAccess} className="flex-1 px-4 py-3 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">
                Unlock Manager Mode
              </button>
              <button onClick={() => setCurrentView('validator')} className="px-4 py-3 border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-50">
                Validator Mode
              </button>
            </div>
          </div>
        </div>
        {authModal}
      </>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-bold text-lg sm:text-xl tracking-tight text-slate-900 flex items-center gap-2">
             <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0">V</div>
             <span className="leading-tight">VIP Ticket Master</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <button 
                onClick={() => setCurrentView('validator')}
                className="w-full sm:w-auto px-3 py-2 bg-brand-600/10 text-brand-800 text-sm sm:text-base font-medium rounded-lg shadow-sm hover:bg-brand-600/20 transition-colors flex items-center justify-center gap-2"
            >
                <Search className="w-4 h-4" /> Validator Mode
            </button>
            <button 
                onClick={handleExitManager}
                className="w-full sm:w-auto px-3 py-2 bg-white text-slate-700 border border-slate-200 text-sm sm:text-base font-medium rounded-lg shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
                <LayoutGrid className="w-4 h-4" /> Lock Manager
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase text-slate-500 font-semibold tracking-wide">Manager Mode</p>
                <h1 className="text-2xl font-bold text-slate-900">Manage Events & Tickets</h1>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="px-2 py-1 bg-slate-100 rounded-md">Local Backup & Restore</span>
                <span className={`px-2 py-1 rounded-md ${fireStatus === 'ready' ? 'bg-emerald-100 text-emerald-700' : fireStatus === 'authenticating' ? 'bg-amber-100 text-amber-700' : fireStatus === 'needs_auth' ? 'bg-slate-100 text-slate-700' : 'bg-slate-200 text-slate-600'}`}>
                  Firebase {fireStatus === 'ready' ? 'Ready' : fireStatus === 'authenticating' ? 'Auth…' : fireStatus === 'needs_auth' ? 'Sign-in required' : fireStatus === 'error' ? 'Error' : 'Off'}
                </span>
                {fireError && <span className="text-red-600">({fireError})</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {fireStatus === 'needs_auth' || fireStatus === 'error' ? (
                <button
                  onClick={handleFireLogin}
                  className="px-3 py-2 bg-blue-600 text-white text-sm sm:text-base font-medium rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
                >
                  Google 登录
                </button>
              ) : fireStatus === 'ready' ? (
                <button
                  onClick={handleFireLogout}
                  className="px-3 py-2 bg-white text-slate-700 border border-slate-200 text-sm sm:text-base font-medium rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
                  title={fireUser?.email || '已登录'}
                >
                  退出 Google
                </button>
              ) : null}
              <button
                onClick={openCreateModal}
                className="px-3 py-2 bg-brand-600 text-white text-sm sm:text-base font-medium rounded-lg shadow-sm hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> New Event
              </button>
              <button
                onClick={handleFireBackup}
                disabled={fireStatus !== 'ready' || fireBusy !== 'idle'}
                className={`px-3 py-2 text-sm sm:text-base font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors ${fireStatus === 'ready' && fireBusy === 'idle' ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-teal-100 text-teal-700 cursor-not-allowed'}`}
              >
                <Upload className="w-4 h-4" /> Fire Backup
              </button>
              <button
                onClick={handleFireRestore}
                disabled={fireStatus !== 'ready' || fireBusy !== 'idle'}
                className={`px-3 py-2 text-sm sm:text-base font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors ${fireStatus === 'ready' && fireBusy === 'idle' ? 'bg-white text-teal-700 border border-teal-200 hover:bg-teal-50' : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'}`}
              >
                <Download className="w-4 h-4" /> Fire Restore
              </button>
              <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200">
                <button
                  onClick={handleExportData}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-brand-600 hover:bg-slate-50 rounded-md flex items-center justify-center gap-2 transition-colors"
                  title="Download Backup"
                >
                  <Download className="w-4 h-4" /> Backup
                </button>
                <div className="w-px h-4 bg-slate-200"></div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleImportFile}
                  className="hidden"
                  accept=".json"
                />
                <button
                  onClick={handleImportTrigger}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-brand-600 hover:bg-slate-50 rounded-md flex items-center justify-center gap-2 transition-colors"
                  title="Restore from Backup"
                >
                  <Upload className="w-4 h-4" /> Restore
                </button>
              </div>
            </div>
          </div>

          {/* Tabs for Active / Archived */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setShowArchived(false)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${!showArchived ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Active
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${showArchived ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Archived
            </button>
          </div>
        </div>
{/* Event Grid */}
        {filteredEvents.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">No events found</h3>
                <p className="text-slate-500 mt-1">
                    {showArchived ? "No archived events." : "Get started by creating a new VIP event."}
                </p>
                {!showArchived && (
                    <button onClick={openCreateModal} className="mt-4 text-brand-600 font-medium hover:underline">New Event</button>
                )}
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map(event => {
                    const eventTickets = tickets.filter(t => t.eventId === event.id);
                    const usedCount = eventTickets.filter(t => t.status === TicketStatus.USED).length;
                    
                    return (
                        <div key={event.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                            <div className="p-6 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-lg font-bold text-slate-900 line-clamp-1" title={event.name}>{event.name}</h3>
                                    {event.isArchived && <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded font-medium">Archived</span>}
                                </div>
                                <p className="text-slate-500 text-sm mb-6 line-clamp-2 h-10">{event.description || "No description provided."}</p>
                                
                                <div className="flex gap-4 text-sm border-t border-slate-100 pt-4">
                                    <div>
                                        <span className="block text-xs text-slate-400 uppercase font-bold">Total</span>
                                        <span className="font-mono font-medium text-slate-700">{eventTickets.length}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-slate-400 uppercase font-bold">Used</span>
                                        <span className="font-mono font-medium text-slate-700">{usedCount}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-slate-400 uppercase font-bold">Rate</span>
                                        <span className="font-mono font-medium text-slate-700">{eventTickets.length ? Math.round((usedCount/eventTickets.length)*100) : 0}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-between items-center">
                                {!event.isArchived ? (
                                    <>
                                        <button 
                                            onClick={() => { setSelectedEventId(event.id); setCurrentView('event_detail'); }}
                                            className="text-brand-600 font-medium hover:text-brand-800 text-sm"
                                        >
                                            Manage Tickets &rarr;
                                        </button>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => openEditModal(event)}
                                                className="text-slate-400 hover:text-brand-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                                                title="Edit Event Name"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleArchiveEvent(event.id)}
                                                className="text-slate-400 hover:text-red-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                                                title="Archive Event"
                                            >
                                                <Archive className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                     <div className="flex items-center gap-3">
                                       <button 
                                          onClick={() => handleRestoreEvent(event.id)}
                                          className="text-slate-600 font-medium hover:text-slate-900 text-sm flex items-center gap-1"
                                      >
                                          <LayoutGrid className="w-3 h-3" /> Restore Event
                                      </button>
                                      <button 
                                          onClick={() => handleDeleteEvent(event.id)}
                                          className="text-red-600 font-medium hover:text-red-800 text-sm flex items-center gap-1"
                                      >
                                          <X className="w-4 h-4" /> Delete
                                      </button>
                                     </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </main>

      <footer className="w-full border-t border-slate-200 bg-white text-xs text-slate-500 px-4 sm:px-6 py-3 text-center">
        Version {buildMeta.version} • Built {buildMeta.buildTime || 'dev'}
      </footer>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-900">
                        {showEditModal ? 'Edit Event' : 'Create New Event'}
                    </h2>
                    <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Theme / Description</label>
                        <input 
                            type="text" 
                            className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-brand-500 focus:border-brand-500"
                            placeholder="e.g. Summer Gala 2024"
                            value={eventDesc}
                            onChange={e => setEventDesc(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Event Name</label>
                        <input 
                            type="text" 
                            className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-brand-500 focus:border-brand-500"
                            value={eventName}
                            onChange={e => setEventName(e.target.value)}
                        />
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <button 
                        onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                        className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={showEditModal ? handleUpdateEvent : handleCreateEvent}
                        disabled={!eventName}
                        className="px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {showEditModal ? 'Save Changes' : 'Create Event'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
    {authModal}
    </>
  );
};

export default App;
