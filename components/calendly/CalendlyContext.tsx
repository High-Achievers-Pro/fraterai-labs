"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CalendlyPrefill {
  name?: string;
  email?: string;
  company?: string;
  subject?: string;
}

export interface OpenCalendlyOptions {
  url?: string;
  prefill?: CalendlyPrefill;
}

interface CalendlyContextType {
  isOpen: boolean;
  calendlyUrl: string;
  prefill: CalendlyPrefill;
  openCalendly: (options?: OpenCalendlyOptions) => void;
  closeCalendly: () => void;
  setPrefill: (prefill: CalendlyPrefill) => void;
  lastScheduledEvent: any | null;
}

const DEFAULT_CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/fraterai-fraterailabs/30min';

const CalendlyContext = createContext<CalendlyContextType | undefined>(undefined);

export function CalendlyProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [calendlyUrl, setCalendlyUrl] = useState(DEFAULT_CALENDLY_URL);
  const [prefill, setPrefillState] = useState<CalendlyPrefill>({});
  const [lastScheduledEvent, setLastScheduledEvent] = useState<any | null>(null);

  const openCalendly = (options?: OpenCalendlyOptions) => {
    if (options?.url) {
      setCalendlyUrl(options.url);
    } else {
      setCalendlyUrl(DEFAULT_CALENDLY_URL);
    }
    if (options?.prefill) {
      setPrefillState((prev) => ({ ...prev, ...options.prefill }));
    }
    setIsOpen(true);
  };

  const closeCalendly = () => {
    setIsOpen(false);
  };

  const setPrefill = (newPrefill: CalendlyPrefill) => {
    setPrefillState((prev) => ({ ...prev, ...newPrefill }));
  };

  // Listen for Calendly postMessage events
  useEffect(() => {
    const handleCalendlyEvent = (e: MessageEvent) => {
      if (e.origin.includes('calendly.com')) {
        if (e.data && e.data.event) {
          if (e.data.event === 'calendly.event_scheduled') {
            console.log('[Calendly Integration] Event scheduled:', e.data.payload);
            setLastScheduledEvent(e.data.payload);
          }
        }
      }
    };

    window.addEventListener('message', handleCalendlyEvent);
    return () => {
      window.removeEventListener('message', handleCalendlyEvent);
    };
  }, []);

  return (
    <CalendlyContext.Provider
      value={{
        isOpen,
        calendlyUrl,
        prefill,
        openCalendly,
        closeCalendly,
        setPrefill,
        lastScheduledEvent,
      }}
    >
      {children}
    </CalendlyContext.Provider>
  );
}

export function useCalendly() {
  const context = useContext(CalendlyContext);
  if (!context) {
    throw new Error('useCalendly must be used within a CalendlyProvider');
  }
  return context;
}
