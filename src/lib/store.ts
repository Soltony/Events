
'use client';

import { events as initialEvents } from '@/lib/mock-data';
import { format } from 'date-fns';

export interface Event {
  id: number;
  name: string;
  date: string;
  location: string;
  image: string;
  hint: string;
  category: string;
  description: string;
}

const EVENTS_STORAGE_KEY = 'events-app-storage';

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

export const addEvent = (eventData: { name: string; location: string; date: Date, category: string, description: string }): void => {
  const storage = getLocalStorage();
  if (!storage) {
    console.warn("localStorage not available, can't add event.");
    return;
  }

  const events = getEvents();
  const newEvent: Event = {
    id: events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1,
    name: eventData.name,
    location: eventData.location,
    date: format(eventData.date, 'yyyy-MM-dd'),
    image: 'https://placehold.co/600x400.png',
    hint: 'event custom',
    category: eventData.category,
    description: eventData.description,
  };
  const updatedEvents = [...events, newEvent];
  storage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(updatedEvents));
};

export const getEventById = (id: number): Event | undefined => {
  const events = getEvents();
  return events.find(event => event.id === id);
};
