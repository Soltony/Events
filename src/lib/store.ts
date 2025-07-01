
'use client';

import { events as initialEvents, ticketTypes as initialTicketTypes } from '@/lib/mock-data';
import { format } from 'date-fns';

export interface Event {
  id: number;
  name: string;
  date: string;
  location: string;
  image: string[];
  hint: string;
  category: string;
  description: string;
}

export interface TicketType {
  id: number;
  eventId: number;
  name: string;
  price: number;
  sold: number;
  total: number;
}

const EVENTS_STORAGE_KEY = 'events-app-storage';
const TICKET_TYPES_STORAGE_KEY = 'ticket-types-app-storage';

const getLocalStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

export const getEvents = (): Event[] => {
  const storage = getLocalStorage();
  if (!storage) {
    return initialEvents;
  }

  const storedEvents = storage.getItem(EVENTS_STORAGE_KEY);
  if (storedEvents) {
    try {
      return JSON.parse(storedEvents) as Event[];
    } catch (e) {
      console.error("Failed to parse events from localStorage", e);
      return initialEvents;
    }
  } else {
    storage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(initialEvents));
    return initialEvents;
  }
};

export const getTicketTypes = (): TicketType[] => {
  const storage = getLocalStorage();
  if (!storage) {
    return initialTicketTypes;
  }

  const storedTicketTypes = storage.getItem(TICKET_TYPES_STORAGE_KEY);
  if (storedTicketTypes) {
    try {
      return JSON.parse(storedTicketTypes) as TicketType[];
    } catch (e) {
      console.error("Failed to parse ticket types from localStorage", e);
      return initialTicketTypes;
    }
  } else {
    storage.setItem(TICKET_TYPES_STORAGE_KEY, JSON.stringify(initialTicketTypes));
    return initialTicketTypes;
  }
};

const addTicketType = (ticketTypeData: Omit<TicketType, 'id' | 'sold'>): void => {
    const storage = getLocalStorage();
    if (!storage) {
        console.warn("localStorage not available, can't add ticket type.");
        return;
    }
    const ticketTypes = getTicketTypes();
    const newTicketType: TicketType = {
        id: ticketTypes.length > 0 ? Math.max(...ticketTypes.map(t => t.id)) + 1 : 1,
        sold: 0,
        ...ticketTypeData,
    };
    const updatedTicketTypes = [...ticketTypes, newTicketType];
    storage.setItem(TICKET_TYPES_STORAGE_KEY, JSON.stringify(updatedTicketTypes));
}

export const addEvent = (eventData: { name: string; location: string; date: { from: Date; to?: Date }; category: string; description: string; images: string[]; tickets: { name: string; price: number; capacity: number }[] }): void => {
  const storage = getLocalStorage();
  if (!storage) {
    console.warn("localStorage not available, can't add event.");
    return;
  }

  const events = getEvents();
  const newEventId = events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1;
  
  let dateString = format(eventData.date.from, 'MMM d, yyyy');
  if (eventData.date.to) {
      dateString = `${format(eventData.date.from, 'MMM d, yyyy')} - ${format(eventData.date.to, 'MMM d, yyyy')}`;
  }

  const newEvent: Event = {
    id: newEventId,
    name: eventData.name,
    location: eventData.location,
    date: dateString,
    image: eventData.images.length > 0 && eventData.images.some(img => img.length > 0)
      ? eventData.images.filter(img => img.length > 0)
      : ['https://placehold.co/600x400.png'],
    hint: 'event custom',
    category: eventData.category,
    description: eventData.description,
  };
  const updatedEvents = [...events, newEvent];
  storage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(updatedEvents));

  eventData.tickets.forEach(ticket => {
    addTicketType({
        eventId: newEventId,
        name: ticket.name,
        price: ticket.price,
        total: ticket.capacity,
    });
  });
};

export const getEventById = (id: number): Event | undefined => {
  const events = getEvents();
  return events.find(event => event.id === id);
};
