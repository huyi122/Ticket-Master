import type { Ticket } from '../types';
import { TicketStatus } from '../types';
import { generateId, uuid } from './id';

export const generateTickets = (
  tickets: Ticket[],
  input: { eventId: string; count: number; length: number },
): Ticket[] => {
  const newTickets: Ticket[] = [];
  const existingCodes = new Set(tickets.map(t => t.code));

  let attempts = 0;
  while (newTickets.length < input.count && attempts < input.count * 5) {
    const code = generateId(input.length);
    if (!existingCodes.has(code)) {
      newTickets.push({
        id: uuid(),
        eventId: input.eventId,
        code,
        status: TicketStatus.ISSUED,
        generatedAt: Date.now(),
      });
      existingCodes.add(code);
    }
    attempts++;
  }

  return [...tickets, ...newTickets];
};

export const addTicketsManual = (
  tickets: Ticket[],
  input: { eventId: string; codes: string[] },
): Ticket[] => {
  const newTickets = input.codes.map(code => ({
    id: uuid(),
    eventId: input.eventId,
    code,
    status: TicketStatus.ISSUED,
    generatedAt: Date.now(),
  }));
  return [...tickets, ...newTickets];
};

export const updateTicket = (
  tickets: Ticket[],
  ticketId: string,
  updates: Partial<Ticket>,
): Ticket[] => {
  return tickets.map(t => (t.id === ticketId ? { ...t, ...updates } : t));
};

export const deleteTicket = (tickets: Ticket[], ticketId: string): Ticket[] => {
  return tickets.filter(t => t.id !== ticketId);
};
