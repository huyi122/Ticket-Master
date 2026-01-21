import type { BackupDataV1, EventData, Ticket } from '../types';
import { BACKUP_VERSION } from './constants';

export const buildBackupDataV1 = (events: EventData[], tickets: Ticket[]): BackupDataV1 => ({
  version: BACKUP_VERSION,
  timestamp: Date.now(),
  events,
  tickets,
});

export const isBackupDataV1 = (data: unknown): data is BackupDataV1 => {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;

  if (d.version !== 1) return false;
  if (typeof d.timestamp !== 'number') return false;
  if (!Array.isArray(d.events)) return false;
  if (!Array.isArray(d.tickets)) return false;

  return true;
};

export const makeLocalBackupFilename = (now = new Date()): string => {
  const datePart = now.toISOString().split('T')[0];
  // Keep behavior identical to App.tsx (only replaces first ':')
  const timePart = now.toTimeString().slice(0, 8).replace(':', '-');
  return `vip-ticket-backup-${datePart}-${timePart}.json`;
};

export const makeFirebaseBackupFilename = (now = new Date()): string => {
  const datePart = now.toISOString().split('T')[0];
  const timePart = now.toTimeString().slice(0, 5).replace(':', '-');
  return `vip-ticket-backup-${datePart}-${timePart}.json`;
};
