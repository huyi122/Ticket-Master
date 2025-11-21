import React, { useState, useMemo } from 'react';
import { EventData, Ticket, TicketStatus } from '../types';
import { ArrowLeft, Plus, Edit3, Save, Trash2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface EventDetailProps {
  event: EventData;
  tickets: Ticket[];
  onBack: () => void;
  onGenerateTickets: (eventId: string, count: number, length: number) => void;
  onAddTicketsManual: (eventId: string, codes: string[]) => void;
  onDeleteTicket: (ticketId: string) => void;
  onUpdateTicket: (ticketId: string, updates: Partial<Ticket>) => void;
  onUpdateEvent: (eventId: string, name: string, description: string) => void;
}

const EventDetail: React.FC<EventDetailProps> = ({
  event,
  tickets,
  onBack,
  onGenerateTickets,
  onAddTicketsManual,
  onDeleteTicket,
  onUpdateTicket,
  onUpdateEvent
}) => {
  const [mode, setMode] = useState<'view' | 'generate' | 'manual'>('view');
  const [genCount, setGenCount] = useState(10);
  const [genLength, setGenLength] = useState(8);
  const [manualInput, setManualInput] = useState('');
  const [manualErrors, setManualErrors] = useState<string[]>([]);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [editCodeInput, setEditCodeInput] = useState('');
  
  // Header editing state
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState(event.name);
  const [headerDesc, setHeaderDesc] = useState(event.description);

  const stats = useMemo(() => {
    const total = tickets.length;
    const used = tickets.filter(t => t.status === TicketStatus.USED).length;
    return { total, used, remaining: total - used };
  }, [tickets]);

  const chartData = [
    { name: 'Used', value: stats.used },
    { name: 'Remaining', value: stats.remaining },
  ];
  const COLORS = ['#ef4444', '#10b981'];

  const validateManualInput = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const duplicates: string[] = [];
    const seen = new Set<string>();
    const existingCodes = new Set(tickets.map(t => t.code));

    lines.forEach((code, index) => {
      if (seen.has(code) || existingCodes.has(code)) {
        duplicates.push(`Line ${index + 1}: "${code}" is a duplicate.`);
      }
      seen.add(code);
    });

    setManualErrors(duplicates);
    return duplicates.length === 0 && lines.length > 0;
  };

  const handleManualSave = () => {
    if (validateManualInput(manualInput)) {
      const codes = manualInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      onAddTicketsManual(event.id, codes);
      setManualInput('');
      setMode('view');
    }
  };

  const handleStartEdit = (t: Ticket) => {
    setEditingTicketId(t.id);
    setEditCodeInput(t.code);
  };

  const handleSaveEdit = () => {
    if (!editingTicketId) return;
    
    // Check duplicate
    const exists = tickets.some(t => t.code === editCodeInput && t.id !== editingTicketId);
    if (exists) {
      alert(`Code "${editCodeInput}" already exists in this event.`);
      return;
    }

    onUpdateTicket(editingTicketId, { code: editCodeInput });
    setEditingTicketId(null);
  };
  
  const handleSaveHeader = () => {
      if (!headerName.trim()) return;
      onUpdateEvent(event.id, headerName, headerDesc);
      setIsEditingHeader(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 flex-1">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          
          {isEditingHeader ? (
              <div className="flex-1 max-w-md space-y-2">
                  <input 
                    type="text" 
                    value={headerName} 
                    onChange={(e) => setHeaderName(e.target.value)} 
                    className="w-full px-2 py-1 text-lg font-bold border rounded border-slate-300 focus:border-brand-500 outline-none"
                    placeholder="Event Name"
                  />
                  <input 
                    type="text" 
                    value={headerDesc} 
                    onChange={(e) => setHeaderDesc(e.target.value)} 
                    className="w-full px-2 py-1 text-sm text-slate-500 border rounded border-slate-300 focus:border-brand-500 outline-none"
                    placeholder="Description"
                  />
                  <div className="flex gap-2 mt-1">
                      <button onClick={handleSaveHeader} className="px-3 py-1 bg-brand-600 text-white text-xs rounded hover:bg-brand-700">Save</button>
                      <button onClick={() => { setIsEditingHeader(false); setHeaderName(event.name); setHeaderDesc(event.description); }} className="px-3 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300">Cancel</button>
                  </div>
              </div>
          ) : (
            <div className="group relative">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-slate-900">{event.name}</h1>
                    <button onClick={() => { setIsEditingHeader(true); setHeaderName(event.name); setHeaderDesc(event.description); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-brand-600 p-1 transition-opacity">
                        <Edit3 className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-sm text-slate-500">{event.description || 'No description'} • Created {new Date(event.createdAt).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats Column */}
        <div className="space-y-6">
            {/* Overview Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Overview</h3>
                <div className="w-full" style={{ minWidth: 1, minHeight: 1, height: 200 }}>
                    <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0}>
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="p-2 bg-slate-50 rounded-lg">
                        <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                        <div className="text-xs text-slate-500">Total</div>
                    </div>
                    <div className="p-2 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{stats.remaining}</div>
                        <div className="text-xs text-green-600">Valid</div>
                    </div>
                    <div className="p-2 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{stats.used}</div>
                        <div className="text-xs text-red-600">Used</div>
                    </div>
                </div>
            </div>

            {/* Actions Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Ticket Management</h3>
                <div className="space-y-3">
                     <button 
                        onClick={() => setMode('generate')}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${mode === 'generate' ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-500' : 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700'}`}
                    >
                        <Plus className="w-4 h-4" /> Auto-Generate Batch
                    </button>
                     <button 
                        onClick={() => setMode('manual')}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${mode === 'manual' ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-500' : 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700'}`}
                    >
                        <Edit3 className="w-4 h-4" /> Bulk Add / Edit
                    </button>
                </div>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            
            {/* Mode: Generate */}
            {mode === 'generate' && (
                <div className="p-6 bg-brand-50 border-b border-brand-100">
                    <h3 className="font-bold text-brand-900 mb-4">Generate Random Tickets</h3>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div>
                            <label className="block text-xs font-medium text-brand-800 mb-1">Count</label>
                            <input type="number" min="1" max="1000" value={genCount} onChange={e => setGenCount(Number(e.target.value))} className="w-24 px-3 py-2 rounded-md border-brand-200 focus:border-brand-500 focus:ring-brand-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-brand-800 mb-1">Length</label>
                            <input type="number" min="4" max="16" value={genLength} onChange={e => setGenLength(Number(e.target.value))} className="w-24 px-3 py-2 rounded-md border-brand-200 focus:border-brand-500 focus:ring-brand-500" />
                        </div>
                        <button 
                            onClick={() => {
                                onGenerateTickets(event.id, genCount, genLength);
                                setMode('view');
                            }}
                            className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 font-medium"
                        >
                            Generate
                        </button>
                         <button onClick={() => setMode('view')} className="px-4 py-2 text-slate-600 hover:text-slate-800">Cancel</button>
                    </div>
                </div>
            )}

            {/* Mode: Manual Input */}
            {mode === 'manual' && (
                <div className="p-6 bg-orange-50 border-b border-orange-100 h-full flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                         <h3 className="font-bold text-orange-900">Bulk Add / Edit Tickets</h3>
                         <div className="text-xs text-orange-800">Paste IDs, one per line</div>
                    </div>
                    
                    <textarea
                        value={manualInput}
                        onChange={(e) => {
                            setManualInput(e.target.value);
                            if (manualErrors.length > 0) validateManualInput(e.target.value);
                        }}
                        className={`flex-1 w-full p-4 rounded-md border font-mono text-sm ${manualErrors.length > 0 ? 'border-red-300 bg-red-50' : 'border-orange-200 focus:border-orange-500'} focus:ring focus:ring-orange-200 outline-none resize-none mb-4`}
                        placeholder="VIP-A1B2&#10;VIP-C3D4&#10;..."
                    />
                    
                    {manualErrors.length > 0 && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-md text-red-800 text-xs max-h-32 overflow-y-auto">
                            <div className="font-bold mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Errors Found:</div>
                            {manualErrors.map((err, i) => <div key={i}>{err}</div>)}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button 
                            onClick={handleManualSave}
                            className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-medium flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" /> Validate & Save
                        </button>
                        <button onClick={() => { setMode('view'); setManualErrors([]); setManualInput(''); }} className="px-4 py-2 text-slate-600 hover:text-slate-800">Cancel</button>
                    </div>
                </div>
            )}

            {/* Ticket List */}
            {mode === 'view' && (
                <div className="flex-1 overflow-auto">
                     <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-xs sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3">Ticket Code</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Activity</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                            No tickets generated yet.
                                        </td>
                                    </tr>
                                ) : (
                                    tickets.map((t) => (
                                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-3 font-mono font-medium text-slate-900">
                                                {editingTicketId === t.id ? (
                                                    <div className="flex gap-2">
                                                        <input 
                                                            className="border border-brand-300 rounded px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                                            value={editCodeInput}
                                                            onChange={(e) => setEditCodeInput(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-700"><CheckCircle className="w-4 h-4" /></button>
                                                        <button onClick={() => setEditingTicketId(null)} className="text-red-500 hover:text-red-600"><XCircle className="w-4 h-4" /></button>
                                                    </div>
                                                ) : (
                                                    t.code
                                                )}
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${t.status === TicketStatus.USED ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-slate-500 text-xs">
                                                {t.status === TicketStatus.USED && t.usedAt 
                                                    ? `Used: ${new Date(t.usedAt).toLocaleString()}` 
                                                    : `Gen: ${new Date(t.generatedAt).toLocaleDateString()}`}
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button 
                                                        onClick={() => handleStartEdit(t)}
                                                        disabled={t.status === TicketStatus.USED}
                                                        className="p-1 text-slate-400 hover:text-brand-600 disabled:opacity-30"
                                                        title="Edit ID"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => onDeleteTicket(t.id)}
                                                        className="p-1 text-slate-400 hover:text-red-600"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default EventDetail;