import type { EventData, Ticket } from '../types';
import { uuid } from './id';

export const createEvent = (
  events: EventData[],
  input: { name: string; description: string },
): EventData[] => {
  const newEvent: EventData = {
    id: uuid(),
    name: input.name,
    description: input.description,
    createdAt: Date.now(),
    isArchived: false,
  };
  return [newEvent, ...events];
};

export const updateEvent = (
  events: EventData[],
  input: { eventId: string; name: string; description: string },
): EventData[] => {
  return events.map(e =>
    e.id === input.eventId
      ? { ...e, name: input.name, description: input.description }
      : e,
  );
};

export const archiveEvent = (events: EventData[], eventId: string): EventData[] => {
  return events.map(e => (e.id === eventId ? { ...e, isArchived: true } : e));
};

export const restoreEvent = (events: EventData[], eventId: string): EventData[] => {
  return events.map(e => (e.id === eventId ? { ...e, isArchived: false } : e));
};

export const deleteEvent = (
  events: EventData[],
  tickets: Ticket[],
  eventId: string,
): { events: EventData[]; tickets: Ticket[] } => {
  return {
    events: events.filter(e => e.id !== eventId),
    tickets: tickets.filter(t => t.eventId !== eventId),
  };
};
