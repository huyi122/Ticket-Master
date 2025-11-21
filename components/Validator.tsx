import React, { useState, useEffect } from 'react';
import { Ticket, EventData, TicketStatus } from '../types';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Clock } from 'lucide-react';

interface ValidatorProps {
  events: EventData[];
  tickets: Ticket[];
  onUpdateTicket: (ticketId: string, updates: Partial<Ticket>) => void;
}

const Validator: React.FC<ValidatorProps> = ({ events, tickets, onUpdateTicket }) => {
  const [inputCode, setInputCode] = useState('');
  const [searchResult, setSearchResult] = useState<{
    found: boolean;
    ticket?: Ticket;
    event?: EventData;
    status?: 'valid_unused' | 'valid_used' | 'not_found' | 'archived';
  } | null>(null);

  const handleSearch = () => {
    if (!inputCode.trim()) return;

    const ticket = tickets.find(t => t.code === inputCode.trim());
    
    if (!ticket) {
      setSearchResult({ found: false, status: 'not_found' });
      return;
    }

    const event = events.find(e => e.id === ticket.eventId);
    
    if (!event || event.isArchived) {
      setSearchResult({ found: true, ticket, event, status: 'archived' });
      return;
    }

    if (ticket.status === TicketStatus.USED) {
      setSearchResult({ found: true, ticket, event, status: 'valid_used' });
    } else {
      setSearchResult({ found: true, ticket, event, status: 'valid_unused' });
    }
  };

  const handleCheckIn = () => {
    if (searchResult?.ticket && searchResult.status === 'valid_unused') {
      onUpdateTicket(searchResult.ticket.id, {
        status: TicketStatus.USED,
        usedAt: Date.now(),
      });
      // Optimistic update locally to show success immediately
      setSearchResult(prev => prev ? { ...prev, status: 'valid_used', ticket: { ...prev.ticket!, usedAt: Date.now() } } : null);
    }
  };

  const reset = () => {
    setInputCode('');
    setSearchResult(null);
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
        <div className="bg-slate-900 p-6 text-white">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle className="w-8 h-8 text-brand-500" />
            Ticket Validator
          </h2>
          <p className="text-slate-400 mt-1">Enter ticket ID to verify validity and check-in guests.</p>
        </div>

        <div className="p-8">
          {!searchResult ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ticket ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="e.g. VIP-8X92M"
                    className="flex-1 block w-full rounded-lg border-slate-300 border px-4 py-3 text-lg focus:ring-brand-500 focus:border-brand-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSearch}
                    disabled={!inputCode.trim()}
                    className="bg-brand-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    Verify
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in duration-200">
              {/* Result Display */}
              <div className="text-center mb-8">
                {searchResult.status === 'valid_unused' && (
                  <div className="flex flex-col items-center text-green-600">
                    <CheckCircle className="w-24 h-24 mb-4" />
                    <h3 className="text-3xl font-bold">Valid Ticket</h3>
                    <p className="text-slate-600 mt-2">This ticket is valid and ready for use.</p>
                  </div>
                )}
                {searchResult.status === 'valid_used' && (
                  <div className="flex flex-col items-center text-amber-500">
                    <AlertTriangle className="w-24 h-24 mb-4" />
                    <h3 className="text-3xl font-bold">Already Used</h3>
                    <p className="text-slate-600 mt-2">
                      Used on: {searchResult.ticket?.usedAt ? new Date(searchResult.ticket.usedAt).toLocaleString() : 'Unknown'}
                    </p>
                  </div>
                )}
                {searchResult.status === 'not_found' && (
                  <div className="flex flex-col items-center text-red-500">
                    <XCircle className="w-24 h-24 mb-4" />
                    <h3 className="text-3xl font-bold">Invalid Ticket</h3>
                    <p className="text-slate-600 mt-2">ID "{inputCode}" does not exist in the system.</p>
                  </div>
                )}
                {searchResult.status === 'archived' && (
                  <div className="flex flex-col items-center text-slate-500">
                    <Clock className="w-24 h-24 mb-4" />
                    <h3 className="text-3xl font-bold">Event Archived</h3>
                    <p className="text-slate-600 mt-2">The event associated with this ticket has been archived.</p>
                  </div>
                )}
              </div>

              {/* Details Card */}
              {(searchResult.event && searchResult.ticket) && (
                <div className="bg-slate-50 p-4 rounded-lg mb-8 border border-slate-200">
                  <div className="grid grid-cols-2 gap-4 text-left">
                    <div>
                      <span className="text-xs uppercase text-slate-500 font-bold tracking-wider">Event</span>
                      <p className="font-medium text-slate-900">{searchResult.event.name}</p>
                    </div>
                    <div>
                      <span className="text-xs uppercase text-slate-500 font-bold tracking-wider">Ticket ID</span>
                      <p className="font-medium font-mono text-slate-900">{searchResult.ticket.code}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4 justify-center">
                <button
                  onClick={reset}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Check Another
                </button>
                
                {searchResult.status === 'valid_unused' && (
                  <button
                    onClick={handleCheckIn}
                    className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold shadow-lg hover:bg-green-700 transform hover:scale-105 transition-all"
                  >
                    MARK AS USED
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Validator;
