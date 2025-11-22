import React, { useState, useEffect, useRef } from 'react';
import { Ticket, EventData, TicketStatus } from '../types';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Clock, Camera } from 'lucide-react';

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const jsqrRef = useRef<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [canScan, setCanScan] = useState(false);

  const stopScan = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const handleSearch = (codeOverride?: string) => {
    const code = (codeOverride ?? inputCode).trim();
    if (!code) return;
    setInputCode(code);

    const ticket = tickets.find(t => t.code === code);
    
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

  const startScan = async () => {
    if (!canScan) return;
    setScanError(null);
    try {
      // render preview first so video ref exists
      setIsScanning(true);
      await new Promise<void>((resolve) => {
        const check = () => {
          if (videoRef.current) resolve()
          else requestAnimationFrame(check);
        };
        check();
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;

      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('autoplay', 'true');
        videoEl.muted = true;
        videoEl.controls = false;
        try {
          await new Promise<void>((resolve) => {
            if (videoEl.readyState >= 1) { resolve(); return; }
            const onReady = () => { videoEl.removeEventListener('loadedmetadata', onReady); resolve(); };
            videoEl.addEventListener('loadedmetadata', onReady, { once: true });
          });
          await videoEl.play();
        } catch (e) {
          console.error('Video play failed', e);
          setScanError('Camera preview unavailable. Try reopening scan.');
        }
      }

      const hasBarcode = typeof (window as any).BarcodeDetector !== 'undefined';
      let detector: any = null;
      if (hasBarcode) {
        const Detector = (window as any).BarcodeDetector;
        detector = new Detector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13'] });
      } else {
        if (!jsqrRef.current) {
          const mod = await import('jsqr');
          jsqrRef.current = (mod as any).default || mod;
        }
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }
      }

      let emptyFrameCount = 0;
      const tick = async () => {
        const video = videoRef.current;
        if (!video) return;

        const hasStream = !!(video as any).srcObject;
        const w = video.videoWidth;
        const h = video.videoHeight;

        if (!hasStream || !w || !h) {
          emptyFrameCount += 1;
          if (emptyFrameCount > 120) {
            setScanError('Camera feed unavailable. Try reopening scan or switching camera.');
            stopScan();
            return;
          }
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        try {
          if (hasBarcode && detector) {
            const codes = await detector.detect(video);
            if (codes && codes.length > 0) {
              const value = codes[0].rawValue;
              stopScan();
              handleSearch(value);
              return;
            }
          } else if (jsqrRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            if (canvas.width !== w || canvas.height !== h) {
              canvas.width = w;
              canvas.height = h;
            }
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              const imageData = ctx.getImageData(0, 0, w, h);
              const code = jsqrRef.current(imageData.data, w, h);
              if (code?.data) {
                stopScan();
                handleSearch(code.data);
                return;
              }
            }
          }
        } catch (err) {
          setScanError('Unable to read code. Try adjusting the camera.');
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch (error) {
      console.error(error);
      setScanError('Camera not available or permission denied.');
      stopScan();
    }
  };

  useEffect(() => {
    const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    setCanScan(hasMedia);

    return () => {
      stopScan();
    };
  }, []);

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
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="e.g. VIP-8X92M"
                    className="flex-1 min-w-[180px] rounded-lg border-slate-300 border px-4 py-3 text-lg focus:ring-brand-500 focus:border-brand-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSearch()}
                    disabled={!inputCode.trim()}
                    className="bg-brand-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    Verify
                  </button>
                  {canScan && (
                    <button
                      onClick={isScanning ? stopScan : startScan}
                      className="px-4 py-3 bg-brand-50 text-brand-700 border border-brand-100 rounded-lg font-semibold hover:bg-brand-100 transition-colors flex items-center gap-2"
                    >
                      <Camera className="w-5 h-5" /> {isScanning ? 'Stop' : 'Scan QR'}
                    </button>
                  )}
                </div>
                {scanError && <p className="text-sm text-red-600 mt-2">{scanError}</p>}
                {!canScan && (
                  <p className="text-xs text-slate-500 mt-2">QR scanning not supported on this device/browser. Manual entry only.</p>
                )}
                {isScanning && (
                  <div className="mt-4 bg-slate-900 rounded-lg p-2">
                    <video ref={videoRef} className="w-full rounded-md bg-black aspect-video object-cover" muted playsInline autoPlay />
                    <p className="text-xs text-white/70 mt-2">Point the QR/Barcode inside the frame. Scans fill the field automatically.</p>
                  </div>
                )}
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
