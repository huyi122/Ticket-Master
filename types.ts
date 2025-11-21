export interface EventData {
  id: string;
  name: string;
  description: string;
  createdAt: number; // timestamp
  isArchived: boolean;
}

export interface Ticket {
  id: string; // Unique internal ID
  eventId: string;
  code: string; // The visible ticket ID
  status: TicketStatus;
  generatedAt: number;
  usedAt?: number;
}

export enum TicketStatus {
  ISSUED = 'ISSUED',
  USED = 'USED',
}

export interface ValidationResult {
  isValid: boolean;
  ticket?: Ticket;
  event?: EventData;
  message: string;
}

export interface DuplicateError {
  code: string;
  lineIndex: number;
}
